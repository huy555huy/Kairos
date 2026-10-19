import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { pipeline, env } from '@huggingface/transformers';
import { agnes } from 'ml-hclust';

// Research probe only: no screen capture, user data, cloud inference or Agent actions.
const model = 'Xenova/multilingual-e5-small';
const revision = '761b726dd34fb83930e26aab4e9ac3899aa1fa78';
const cutDistance = 0.18; // Fixed starting parameter; sensitivity is reported, not hidden.
const fixtureText = await readFile(new URL('./fixtures.json', import.meta.url), 'utf8');
const fixture = JSON.parse(fixtureText);
const rows = [...fixture.observations].sort((a,b) => a.id.localeCompare(b.id));
env.cacheDir = new URL('./.cache/models/', import.meta.url).pathname;
await mkdir(new URL('./.cache/', import.meta.url), { recursive: true });
const initialRss = process.memoryUsage().rss;
const loadStart = performance.now();
console.log('Loading pinned q8 multilingual encoder on CPU...');
const encoder = await pipeline('feature-extraction', model, {
  revision, dtype: 'q8', device: 'cpu',
});
const loadMs = performance.now() - loadStart;
const vectors = [];
const encodeMs = [];
for (const row of rows) {
  const start = performance.now();
  // E5 model card: query prefix for symmetric similarity/clustering, including Chinese.
  const output = await encoder(`query: ${row.text}`, { pooling: 'mean', normalize: true });
  vectors.push(Array.from(output.data));
  encodeMs.push(performance.now() - start);
}
const dot = (a,b) => a.reduce((sum,v,i) => sum + v*b[i], 0);
const distance = (a,b) => Math.max(0, Math.min(2, 1-dot(a,b)));
for (const v of vectors) {
  assert.equal(v.length,384);
  assert.ok(Math.abs(dot(v,v)-1)<1e-4);
}
function cluster(indices, threshold=cutDistance) {
  if (!indices.length) return [];
  if (indices.length===1) return [indices];
  const tree = agnes(indices.map(i=>vectors[i]), { method:'average', distanceFunction:distance });
  return tree.cut(threshold).map(c=>c.indices().map(i=>indices[i]));
}
const all = rows.map((_,i)=>i);
const startCluster = performance.now();
const groups = cluster(all);
const clusterMs = performance.now()-startCluster;
const ids = groups => groups.map(g=>g.map(i=>rows[i].id).sort()).sort((a,b)=>a.join().localeCompare(b.join()));
function pairMetrics(groups) {
  const membership = new Map(groups.flatMap((g,k)=>g.map(i=>[i,k])));
  let tp=0,fp=0,fn=0;
  for (let i=0;i<rows.length;i++) for (let j=i+1;j<rows.length;j++) {
    const truth=rows[i].label===rows[j].label;
    const prediction=membership.get(i)===membership.get(j);
    if (prediction&&truth) tp++;
    if (prediction&&!truth) fp++;
    if (!prediction&&truth) fn++;
  }
  return {tp,fp,fn,precision:tp/(tp+fp)||0,recall:tp/(tp+fn)||0};
}
const translations=fixture.pairedTranslations.map(([left,right])=>{
  const i=rows.findIndex(r=>r.id===left),j=rows.findIndex(r=>r.id===right);
  const ranking=all.filter(k=>k!==i).sort((a,b)=>dot(vectors[i],vectors[b])-dot(vectors[i],vectors[a]));
  return {left,right,similarity:dot(vectors[i],vectors[j]),rank:ranking.indexOf(j)+1};
});
const positive=rows.findIndex(r=>r.id==='positive'),negative=rows.findIndex(r=>r.id==='negative');
const contradictionSimilarity=dot(vectors[positive],vectors[negative]);
// Retraction is implemented by changing the bounded live set and reclustering,
// rather than inventing inverse updates for a streaming clustering algorithm.
const kept=all.filter(i=>i!==negative);
assert.ok(ids(cluster(kept)).flat().every(id=>id!=='negative'));
const stableInput=all.slice().reverse().sort((a,b)=>rows[a].id.localeCompare(rows[b].id));
assert.deepEqual(ids(cluster(all)),ids(cluster(stableInput)));
// Throughput probe repeats vectors; this measures runtime only, not semantic accuracy.
const perfVectors=Array.from({length:256},(_,i)=>vectors[i%vectors.length]);
const perfStart=performance.now();
agnes(perfVectors,{method:'average',distanceFunction:distance}).cut(cutDistance);
const cluster256Ms=performance.now()-perfStart;
async function bytesIn(dir) {
  let total=0;
  for (const item of await readdir(dir,{withFileTypes:true})) {
    const p=`${dir}/${item.name}`;
    total+=item.isDirectory()?await bytesIn(p):(await stat(p)).size;
  }
  return total;
}
const sortedTimes=[...encodeMs].sort((a,b)=>a-b);
const report={
  schemaVersion:1,
  fixtureKind:'synthetic development cases; not independent evaluation or live activity',
  fixtureSha256:createHash('sha256').update(fixtureText).digest('hex'),
  model,revision,dtype:'q8',dimension:384,
  environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model},
  config:{linkage:'average',metric:'cosine',cutDistance},
  timingsMs:{loadIncludingAnyDownload:loadMs,encodingEach:encodeMs,encodingMedian:sortedTimes[Math.floor(sortedTimes.length/2)],encodingMax:Math.max(...encodeMs),cluster16:clusterMs,cluster256:cluster256Ms},
  resources:{initialRssBytes:initialRss,finalRssBytes:process.memoryUsage().rss,maxRssBytes:process.resourceUsage().maxRSS*1024,modelCacheBytes:await bytesIn(env.cacheDir)},
  translations,
  groups:ids(groups),pairMetrics:pairMetrics(groups),
  sensitivity:[0.12,0.15,0.18,0.21,0.24].map(t=>({distance:t,groups:ids(cluster(all,t)),metrics:pairMetrics(cluster(all,t))})),
  contradictionSimilarity,
  validations:['384-dimensional normalized real model vectors','retraction removes the episode from reclustering','canonical ordering produces identical cluster membership'],
  notValidated:['LLM evidence fusion or hypothesis correctness','ActivityWatch or screen capture','real user distribution','Electron packaging','8-hour CPU and memory profile'],
};
await writeFile(new URL('./results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
await writeFile(new URL('./.cache/embeddings.json',import.meta.url),JSON.stringify({ids:rows.map(r=>r.id),vectors}));
console.log(JSON.stringify({groups:report.groups,translationRanks:translations.map(x=>x.rank),pairMetrics:report.pairMetrics,contradictionSimilarity,medianEncodeMs:report.timingsMs.encodingMedian,cluster256Ms,finalRssMB:report.resources.finalRssBytes/1e6,cacheMB:report.resources.modelCacheBytes/1e6},null,2));
await encoder.dispose();
