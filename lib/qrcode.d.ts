declare module 'qrcode' {
 const QRCode:{toDataURL(text:string,options:{width:number;margin:number;errorCorrectionLevel:string;color:{dark:string;light:string}}):Promise<string>};
 export default QRCode;
}
