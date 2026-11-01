import { getStore } from '@/lib/storage';
import { containsProfanity } from '@/lib/profanity';
async function visitorFingerprint(request: Request, secret?: string) {
 const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
 if (!ip || !secret) return '';
 const userAgent = (request.headers.get('user-agent') || '').slice(0, 384);
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
 const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ip}|${userAgent}`));
 return Array.from(new Uint8Array(signature).slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function escapeHtml(value: string) {
 return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
function buildSubmissionEmail(p: Record<string, string>, fingerprint: string) {
 const sender = [p.firstName.trim(), p.surname.trim()].filter(Boolean).join(' ') || 'Someone';
 const labels: Record<string, string> = {
   coffee: 'A catch-up idea',
   memory: 'A private note',
   detour: 'A recommendation',
   stocks: 'A long-term stock idea',
 };
 const subjects: Record<string, string> = {
   coffee: `Catch-up idea from ${sender}`,
   memory: `A private note from ${sender}`,
   detour: `Recommendation from ${sender}`,
   stocks: `Long-term stock idea from ${sender}`,
 };
 const label = labels[p.kind] ?? 'A new suggestion';
 const subject = subjects[p.kind] ?? `A farewell-page suggestion from ${sender}`;
 const intro = `${sender} left this for you on the farewell page.`;
 const rows = [
   ['Envelope', label],
   ...(p.kind === 'memory' ? [] : [['Choice', p.choice]]),
   ...(p.date ? [['Date idea', p.date]] : []),
 ];
 const rowHtml = rows.map(([key, value]) => `<tr><td style="padding:9px 12px;color:#667085;font:12px Arial,sans-serif;border-bottom:1px solid #e8e5dc;white-space:nowrap">${escapeHtml(key)}</td><td style="padding:9px 12px;color:#243149;font:600 13px Arial,sans-serif;border-bottom:1px solid #e8e5dc">${escapeHtml(value)}</td></tr>`).join('');
 const body = p.message.trim() || 'No additional note.';
 const text = [
   intro,
   '',
   `Envelope: ${label}`,
   ...(p.kind === 'memory' ? [] : [`Choice: ${p.choice}`]),
   ...(p.date ? [`Date idea: ${p.date}`] : []),
   '',
   'Their note:',
   body,
   '',
   `Visitor match (hashed): ${fingerprint || 'Unavailable'}`,
   `Session: ${p.sessionId || 'Unavailable'}`,
   `Submission ID: ${p.id}`,
 ].join('\n');
 const html = `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f4f1e8"><div style="max-width:620px;margin:0 auto;background:#fffdf6;border:1px solid #d9d6ca"><div style="height:5px;background:#c45d35"></div><div style="padding:28px 30px 22px"><p style="margin:0 0 12px;color:#b6532b;font:700 11px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase">One last note before I go</p><h1 style="margin:0 0 10px;color:#26334f;font:400 29px Georgia,serif">${escapeHtml(label)} received</h1><p style="margin:0;color:#596477;font:15px/1.6 Arial,sans-serif">${escapeHtml(intro)}</p></div><div style="padding:0 30px 22px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f5f3eb">${rowHtml}</table></div><div style="margin:0 30px 24px;padding:20px 22px;background:#f2f4f8;border-left:3px solid #294f9b"><p style="margin:0 0 10px;color:#6b7280;font:700 10px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase">Their note</p><div style="color:#293650;font:16px/1.7 Georgia,serif;white-space:pre-wrap">${escapeHtml(body)}</div></div><div style="margin:0 30px;padding:16px 0 24px;border-top:1px solid #e5e2d9;color:#78808e;font:11px/1.7 Arial,sans-serif"><strong style="color:#596477">Private admin details</strong><br>Visitor match (hashed): ${escapeHtml(fingerprint || 'Unavailable')}<br>Session: ${escapeHtml(p.sessionId || 'Unavailable')}<br>Submission ID: ${escapeHtml(p.id)}</div><div style="padding:14px 30px;background:#f4f1e8;color:#7b8190;font:11px Arial,sans-serif">Sent by your farewell notebook · Farewell Notebook</div></div></body></html>`;
 return { subject, text, html };
}
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 try{const raw=await request.text();if(raw.length>12000)return Response.json({error:'Too long'},{status:413});let p:Record<string,string>&{sessionId?:string;website?:string};try{const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=='object')return Response.json({error:'Invalid request'},{status:400});p=parsed as Record<string,string>&{sessionId?:string;website?:string};}catch{return Response.json({error:'Invalid request'},{status:400});}
 if(p.website)return Response.json({ok:true});
 const fields=['id','name','firstName','surname','kind','choice','contact','message','date'];if(fields.some(k=>typeof p[k]!=='string'))return Response.json({error:'Invalid fields'},{status:400});
 if(!/^[0-9a-f-]{36}$/i.test(p.id)||!p.firstName.trim()||p.firstName.length>50||p.name.trim()!==p.firstName.trim()||p.surname.length>60||!['coffee','memory','detour','stocks'].includes(p.kind)||p.choice.length>40||p.contact.length>320||p.message.length>2000||p.date.length>10||(p.kind!=='coffee'&&!p.message.trim()))return Response.json({error:'Check your response'},{status:400});
 if(containsProfanity(p.name,'name')||containsProfanity(p.surname,'name')||containsProfanity(p.message))return Response.json({error:'Please rephrase your note and try again.'},{status:422});
 if (p.sessionId !== undefined && (typeof p.sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(p.sessionId))) return Response.json({error:'Invalid session'},{status:400});
 const store = getStore();
 const fingerprint=await visitorFingerprint(request,process.env.FAREWELL_FINGERPRINT_KEY);
 const created=await store.insertMessage({ id:p.id, name:p.firstName.trim(), surname:p.surname.trim(), kind:p.kind, choice:p.choice, contact:p.contact.trim(), message:p.message.trim(), date:p.date, session_id:typeof p.sessionId==='string'?p.sessionId:'', fingerprint_hash:fingerprint });
 if(created && typeof p.sessionId==='string') await store.insertActivity({ id:crypto.randomUUID(), session_id:p.sessionId, name:p.name.trim(), event:'form_submitted', detail:`${p.kind}:${p.choice}` });
 if(!created){const existing=await store.getMessageEmailStatus(p.id);return Response.json({ok:true,emailStatus:existing??'pending'},{status:200});}

 const mailEnv=process.env;
 let emailStatus='pending';
 if(mailEnv.RESEND_API_KEY&&mailEnv.RESEND_FROM_EMAIL&&mailEnv.NOTIFY_EMAIL){
   const email = buildSubmissionEmail(p as Record<string, string>, fingerprint);
   try{
     const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${mailEnv.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`farewell-${p.id}`},body:JSON.stringify({from:mailEnv.RESEND_FROM_EMAIL,to:[mailEnv.NOTIFY_EMAIL],subject:email.subject,text:email.text,html:email.html})});
     emailStatus=sent.ok?'sent':'failed';
     if(!sent.ok) console.error('Submission email delivery failed',sent.status);
   }catch{emailStatus='failed';console.error('Submission email delivery failed');}
   await store.setMessageEmailStatus(p.id,emailStatus);
 }
 return Response.json({ok:true,emailStatus},{status:201});
 }catch{console.error('Message storage failed');return Response.json({error:'Could not save. Please try again.'},{status:503});}
}
