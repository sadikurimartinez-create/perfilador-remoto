function binaryBase64(bytes:Uint8Array):string {
 if(bytes.byteLength>20*1024*1024)throw new Error('REPORT_BOUNDARY_BINARY_LIMIT');
 const chunks:string[]=[];for(let offset=0;offset<bytes.length;offset+=32768)chunks.push(String.fromCharCode(...bytes.subarray(offset,offset+32768)));return btoa(chunks.join(''));
}
export async function encodeReportBoundaryValue(value: any): Promise<any> {
  if (value instanceof Blob) return { $blobBase64: binaryBase64(new Uint8Array(await value.arrayBuffer())), type: value.type };
  if (value instanceof ArrayBuffer) return { $binaryBase64: binaryBase64(new Uint8Array(value)) };
  if (ArrayBuffer.isView(value)) return { $binaryBase64: binaryBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return Promise.all(value.map(encodeReportBoundaryValue));
  if (value && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await encodeReportBoundaryValue(item)]));
    return Object.fromEntries(entries);
  }
  return value;
}
export function decodeReportBoundaryValue(value: any): any {
  if(value && typeof value==='object' && ('$binaryBase64' in value || '$blobBase64' in value)) {
    const data=value.$binaryBase64??value.$blobBase64;
    if(typeof data!=='string' || data.length>4*Math.ceil(20*1024*1024/3) || data.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw new Error('REPORT_BOUNDARY_BINARY_INVALID');
    let raw:string;try{raw=atob(data);}catch{throw new Error('REPORT_BOUNDARY_BINARY_INVALID');}
    if(btoa(raw)!==data)throw new Error('REPORT_BOUNDARY_BINARY_INVALID');if(raw.length>20*1024*1024)throw new Error('REPORT_BOUNDARY_BINARY_LIMIT');
    const bytes=Uint8Array.from(raw,character=>character.charCodeAt(0));return '$blobBase64' in value ? new Blob([bytes],{type:typeof value.type==='string'?value.type:''}) : bytes;
  }
  if (value && typeof value === "object" && ("$binary" in value || "$blob" in value)) {
    const data = value.$binary ?? value.$blob;
    if (!Array.isArray(data) || data.length > 20 * 1024 * 1024 || data.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error("REPORT_BOUNDARY_BINARY_INVALID");
    const bytes = Uint8Array.from(data);
    return "$blob" in value ? new Blob([bytes], { type: typeof value.type === "string" ? value.type : "" }) : bytes;
  }
  if (Array.isArray(value)) return value.map(decodeReportBoundaryValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeReportBoundaryValue(item)]));
  return value;
}
export async function invokeInstitutionalReportBoundary(operation: string, input: unknown) {
  const body = JSON.stringify({ operation, input: await encodeReportBoundaryValue(input) });
  if (new TextEncoder().encode(body).byteLength > 64 * 1024 * 1024) throw new Error("REPORT_BOUNDARY_PAYLOAD_LIMIT");
  const response = await fetch("/api/institutional/reports", { method: "POST", credentials: "same-origin",
    cache: "no-store", headers: { "Content-Type": "application/json" }, body });
  if (!response.ok) throw new Error("REPORT_BOUNDARY_DENIED");
  return decodeReportBoundaryValue(await response.json());
}
