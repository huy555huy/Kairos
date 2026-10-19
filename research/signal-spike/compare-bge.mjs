import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { agnes } from 'ml-hclust';
const source = await readFile(new URL('./fixtures.json', import.meta.url), 'utf8');
const fixture = JSON.parse(source);
const rows = [...fixture.observations].sort((a,b)=>a.id.localeCompare(b.id));
const base = 'http://127.0.0.1:11434';
async function api(path, body) {
  const r = await fetch(base+path, { ...(body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(55000) });
  const data = await r.json();
  if (!r.ok) throw new Error(`${path}: ${r.status} ${data.error ?? ''}`);
  return data;
}
const tags = await api('/api/tags');
const model = tags.models.find(m=>m.name==='bge-m3:latest');
assert.ok(model, 'Requires the existing bge-m3 model; this script never pulls a model');
assert.equal(model.digest, '7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab',
  'Model changed: record a new comparison explicitly instead of silently mixing versions');
const begin = performance.now();
const response = await api('/api/embed',{model:model.name,input:rows.map(r=>r.text),truncate:false});
const batchMs = performance.now()-begin;
const vectors = response.embeddings;
const dot = (a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
for(const v of vectors) { assert.equal(v.length,1024); assert.ok(Math.abs(dot(v,v)-1)<1e-4); }
const encodeEachMs=[];
for(const row of rows) {
  const start=performance.now();
  await api('/api/embed',{model:model.name,input:row.text,truncate:false});
  encodeEachMs.push(performance.now()-start);
}
const all=rows.map((_,i)=>i);
const translations=fixture.pairedTranslations.map(([left,right])=>{
  const i=rows.findIndex(r=>r.id===left),j=rows.findIndex(r=>r.id===right);
  const ranked=all.filter(k=>k!==i).sort((a,b)=>dot(vectors[i],vectors[b])-dot(vectors[i],vectors[a]));
  return {left,right,similarity:dot(vectors[i],vectors[j]),rank:ranked.indexOf(j)+1};
});
function atDistance(t) {
 const groups=agnes(vectors,{method:'average',distanceFunction:(a,b)=>Math.max(0,1-dot(a,b))}).cut(t).map(c=>c.indices());
 const members=new Map(groups.flatMap((g,k)=>g.map(i=>[i,k])));
 let tp=0,fp=0,fn=0;
 for(let i=0;i<rows.length;i++) for(let j=i+1;j<rows.length;j++) {
   const yes=rows[i].label===rows[j].label,predicted=members.get(i)===members.get(j);
   if(yes&&predicted)tp++; if(!yes&&predicted)fp++; if(yes&&!predicted)fn++;
 }
 return {distance:t,groups:groups.map(g=>g.map(i=>rows[i].id)),metrics:{tp,fp,fn,precision:tp/(tp+fp)||0,recall:tp/(tp+fn)||0}};
}
const repeated=Array.from({length:2048},(_,i)=>vectors[i%vectors.length]);
const retrievalStart=performance.now();
const retrieved=repeated.map((v,i)=>({i,score:dot(vectors[0],v)})).sort((a,b)=>b.score-a.score).slice(0,12);
const retrieval2048Ms=performance.now()-retrievalStart;
assert.equal(retrieved.length,12);
const runtime=await api('/api/ps');
const ownRuntime=runtime.models?.find(m=>m.name===model.name);
const sorted=[...encodeEachMs].sort((a,b)=>a-b);
const result={schemaVersion:1,fixtureKind:fixture.description,fixtureSha256:createHash('sha256').update(source).digest('hex'),model:model.name,digest:model.digest,modelBytes:model.size,dimension:1024,quantization:model.details.quantization_level,environment:{node:process.version,platform:process.platform,arch:process.arch,ollama:(await api('/api/version')).version},timingsMs:{batch16:batchMs,encodingEach:encodeEachMs,encodingMedian:sorted[8],retrieval2048:retrieval2048Ms},runtime:{modelSizeBytes:ownRuntime?.size,vramBytes:ownRuntime?.size_vram,contextLength:ownRuntime?.context_length},translations,contradictionSimilarity:dot(vectors[rows.findIndex(r=>r.id==='positive')],vectors[rows.findIndex(r=>r.id==='negative')]),sensitivity:[0.18,0.25,0.3,0.35].map(atDistance),notValidated:['real user data or independent evaluation','LLM evidence fusion','end-to-end Signal or screen capture','8-hour resource use','retrieval accuracy on 2048 distinct observations (runtime probe repeats vectors)']};
await mkdir(new URL('./.cache/',import.meta.url),{recursive:true});
await writeFile(new URL('./.cache/bge-embeddings.json',import.meta.url),JSON.stringify({ids:rows.map(r=>r.id),vectors}));
await writeFile(new URL('./bge-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({translationRanks:translations.map(t=>t.rank),contradictionSimilarity:result.contradictionSimilarity,timingsMs:result.timingsMs,runtime:result.runtime},null,2));
