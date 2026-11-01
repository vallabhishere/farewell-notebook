"use client";
import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
export function ContactQR({url,title,detail,linkLabel='Open on this device',onOpen,sessionId='',name='',context='contact'}:{url:string;title:string;detail:string;linkLabel?:string;onOpen?:()=>void;sessionId?:string;name?:string;context?:string}){
 const brand=url.includes('linkedin.com')?'linkedin':url.includes('instagram.com')?'instagram':'whatsapp';
 const [image,setImage]=useState('');const [failed,setFailed]=useState(false);const [qrTarget,setQrTarget]=useState(url);const [linkTarget,setLinkTarget]=useState(url);
 useEffect(()=>{
   if(!sessionId){setQrTarget(url);setLinkTarget(url);return;}
   const makeTracked=(event:'qr_scanned'|'link_opened')=>{const endpoint=new URL('/api/track-link',window.location.origin);endpoint.searchParams.set('event',event);endpoint.searchParams.set('sessionId',sessionId);endpoint.searchParams.set('name',name);endpoint.searchParams.set('context',context);endpoint.searchParams.set('to',url);return endpoint.toString();};
   setQrTarget(makeTracked('qr_scanned'));setLinkTarget(makeTracked('link_opened'));
 },[url,sessionId,name,context]);
 useEffect(()=>{let alive=true;setImage('');setFailed(false);QRCode.toDataURL(qrTarget,{width:720,margin:4,errorCorrectionLevel:brand==='whatsapp'?'M':'Q',color:{dark:brand==='linkedin'?'#124f87':brand==='instagram'?'#a73567':'#145b39',light:'#ffffff'}}).then((value:string)=>{if(alive)setImage(value);}).catch(()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[qrTarget,brand]);
 return <section className={`qr-card branded-qr ${brand}`}><div className="qr-image">{image?<><img src={image} width={720} height={720} alt={`Scan with your phone camera: ${title}`} /><span className={`qr-brand-mark ${brand}`}><img src={`/${brand}-mark.svg`} alt="" width={32} height={32}/></span></>:<span role="status">{failed?'Use the link below':'Preparing QR…'}</span>}</div><div className="qr-copy"><h3>{title}</h3><p>{detail}</p><a href={linkTarget} onClick={onOpen} target="_blank" rel="noreferrer">{linkLabel}</a></div></section>;
}
