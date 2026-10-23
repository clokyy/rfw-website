/* Shared, stable internal IDs. Legacy IDs are deterministic until the next catalogue save. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RFWBarcodes=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const valid=value=>/^RF\d{12}$/.test(value||'');
 function legacy(seed){let hash=14695981039346656037n;for(const c of seed){hash^=BigInt(c.codePointAt(0));hash=BigInt.asUintN(64,hash*1099511628211n)}return 'RF'+String(hash%1000000000000n).padStart(12,'0')}
 function ensure(products){const used=new Set();for(const p of products){if(!p.barcode)continue;if(!valid(p.barcode))throw new Error('Invalid product barcode');if(used.has(p.barcode))throw new Error('Duplicate product barcode');used.add(p.barcode)}for(const p of products){if(p.barcode)continue;let attempt=0,id;do{id=legacy(`${p.code||''}\0${p.name||''}\0${attempt++}`)}while(used.has(id));p.barcode=id;used.add(id)}return products}
 function create(products){const used=new Set(products.map(p=>p.barcode));let id;do{const bytes=new Uint32Array(2);globalThis.crypto.getRandomValues(bytes);id='RF'+String(((BigInt(bytes[0])<<32n)|BigInt(bytes[1]))%1000000000000n).padStart(12,'0')}while(used.has(id));return id}
 function find(products,value){value=String(value||'').trim();if(!valid(value))return -1;const matches=products.map((p,i)=>p.barcode===value?i:-1).filter(i=>i>=0);return matches.length===1?matches[0]:-1}
 return {valid,ensure,create,find};
});
