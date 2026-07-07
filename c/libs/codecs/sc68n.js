
/* <wrapper> */
import { initBackend, loadWasm } from "./common/codecBackend.js";

export async function init(options = {}) {
const {
  createCodecPlayer,
  ScriptNodePlayer,
  EmsHEAP16BackendAdapter,
  SimpleFileMapper,
  ScopeDataProvider,
  HEAPF32ScopeProvider,
  HEAP32ScopeProvider,
  HEAP16ScopeProvider
} = initBackend(options);
const window = {
  ScriptNodePlayer,
  console: globalThis.console
};
options.wasmBinary ??= await loadWasm(import.meta.url);
/* </wrapper> */

// create separate namespace for all the Emscripten stuff.. otherwise naming clashes may occur especially when
// optimizing using closure compiler..
window.spp_backend_state_SC68n= {
	locateFile: function(path, scriptDirectory) { return (typeof window.WASM_SEARCH_PATH == 'undefined') ? path : window.WASM_SEARCH_PATH + path; },
	print: function(t) {
		// suppress annoying "source file" info
		setTimeout(console.log.bind(console, t));	// "lose" the original context
	},
	notReady: true,
	/* <wrapper> */...options,/* </wrapper> */
	adapterCallback: function(){}	// overwritten later
};
window.spp_backend_state_SC68n["onRuntimeInitialized"] = function() {	// emscripten callback needed in case async init is used (e.g. for WASM)
	this.notReady= false;
	this.adapterCallback();
}.bind(window.spp_backend_state_SC68n);

var backend_SC68n = (function(Module) {var e;e||(e=typeof Module !== 'undefined' ? Module : {});var h={},k;for(k in e)e.hasOwnProperty(k)&&(h[k]=e[k]);e.arguments=[];e.thisProgram="./this.program";e.quit=function(a,b){throw b;};e.preRun=[];e.postRun=[];var n=!1,q=!1,r=!1,ba=!1;n="object"===typeof window;q="function"===typeof importScripts;r="object"===typeof process&&"function"===typeof require&&!n&&!q;ba=!n&&!r&&!q;var t="";function ca(a){return e.locateFile?e.locateFile(a,t):t+a}
if(r){t=__dirname+"/";var da,ea;e.read=function(a,b){da||(da=require("fs"));ea||(ea=require("path"));a=ea.normalize(a);a=da.readFileSync(a);return b?a:a.toString()};e.readBinary=function(a){a=e.read(a,!0);a.buffer||(a=new Uint8Array(a));assert(a.buffer);return a};1<process.argv.length&&(e.thisProgram=process.argv[1].replace(/\\/g,"/"));e.arguments=process.argv.slice(2);"undefined"!==typeof module&&(module.exports=e);process.on("uncaughtException",function(a){throw a;});process.on("unhandledRejection",
u);e.quit=function(a){process.exit(a)};e.inspect=function(){return"[Emscripten Module object]"}}else if(ba)"undefined"!=typeof read&&(e.read=function(a){return read(a)}),e.readBinary=function(a){if("function"===typeof readbuffer)return new Uint8Array(readbuffer(a));a=read(a,"binary");assert("object"===typeof a);return a},"undefined"!=typeof scriptArgs?e.arguments=scriptArgs:"undefined"!=typeof arguments&&(e.arguments=arguments),"function"===typeof quit&&(e.quit=function(a){quit(a)});else if(n||q)q?
t=self.location.href:document.currentScript&&(t=document.currentScript.src),t=0!==t.indexOf("blob:")?t.substr(0,t.lastIndexOf("/")+1):"",e.read=function(a){var b=new XMLHttpRequest;b.open("GET",a,!1);b.send(null);return b.responseText},q&&(e.readBinary=function(a){var b=new XMLHttpRequest;b.open("GET",a,!1);b.responseType="arraybuffer";b.send(null);return new Uint8Array(b.response)}),e.readAsync=function(a,b,c){var d=new XMLHttpRequest;d.open("GET",a,!0);d.responseType="arraybuffer";d.onload=function(){200==
d.status||0==d.status&&d.response?b(d.response):c()};d.onerror=c;d.send(null)},e.setWindowTitle=function(a){document.title=a};var fa=e.print||("undefined"!==typeof console?console.log.bind(console):"undefined"!==typeof print?print:null),v=e.printErr||("undefined"!==typeof printErr?printErr:"undefined"!==typeof console&&console.warn.bind(console)||fa);for(k in h)h.hasOwnProperty(k)&&(e[k]=h[k]);h=void 0;function ha(a){var b=w;w=w+a+15&-16;return b}
function ia(a){var b;b||(b=16);return Math.ceil(a/b)*b}var ja={"f64-rem":function(a,b){return a%b},"debugger":function(){debugger}},ka=!1;function assert(a,b){a||u("Assertion failed: "+b)}var pa={stackSave:function(){la()},stackRestore:function(){ma()},arrayToC:function(a){var b=na(a.length);x.set(a,b);return b},stringToC:function(a){var b=0;if(null!==a&&void 0!==a&&0!==a){var c=(a.length<<2)+1;b=na(c);oa(a,y,b,c)}return b}},qa={string:pa.stringToC,array:pa.arrayToC};
function z(a,b){if(0===b||!a)return"";for(var c=0,d,f=0;;){d=y[a+f>>0];c|=d;if(0==d&&!b)break;f++;if(b&&f==b)break}b||(b=f);d="";if(128>c){for(;0<b;)c=String.fromCharCode.apply(String,y.subarray(a,a+Math.min(b,1024))),d=d?d+c:c,a+=1024,b-=1024;return d}return ra(a)}var sa="undefined"!==typeof TextDecoder?new TextDecoder("utf8"):void 0;
function A(a,b){for(var c=b;a[c];)++c;if(16<c-b&&a.subarray&&sa)return sa.decode(a.subarray(b,c));for(c="";;){var d=a[b++];if(!d)return c;if(d&128){var f=a[b++]&63;if(192==(d&224))c+=String.fromCharCode((d&31)<<6|f);else{var g=a[b++]&63;if(224==(d&240))d=(d&15)<<12|f<<6|g;else{var l=a[b++]&63;if(240==(d&248))d=(d&7)<<18|f<<12|g<<6|l;else{var m=a[b++]&63;if(248==(d&252))d=(d&3)<<24|f<<18|g<<12|l<<6|m;else{var p=a[b++]&63;d=(d&1)<<30|f<<24|g<<18|l<<12|m<<6|p}}}65536>d?c+=String.fromCharCode(d):(d-=
65536,c+=String.fromCharCode(55296|d>>10,56320|d&1023))}}else c+=String.fromCharCode(d)}}function ra(a){return A(y,a)}
function oa(a,b,c,d){if(!(0<d))return 0;var f=c;d=c+d-1;for(var g=0;g<a.length;++g){var l=a.charCodeAt(g);if(55296<=l&&57343>=l){var m=a.charCodeAt(++g);l=65536+((l&1023)<<10)|m&1023}if(127>=l){if(c>=d)break;b[c++]=l}else{if(2047>=l){if(c+1>=d)break;b[c++]=192|l>>6}else{if(65535>=l){if(c+2>=d)break;b[c++]=224|l>>12}else{if(2097151>=l){if(c+3>=d)break;b[c++]=240|l>>18}else{if(67108863>=l){if(c+4>=d)break;b[c++]=248|l>>24}else{if(c+5>=d)break;b[c++]=252|l>>30;b[c++]=128|l>>24&63}b[c++]=128|l>>18&63}b[c++]=
128|l>>12&63}b[c++]=128|l>>6&63}b[c++]=128|l&63}}b[c]=0;return c-f}"undefined"!==typeof TextDecoder&&new TextDecoder("utf-16le");var buffer,x,y,ta,B;function ua(){e.HEAP8=x=new Int8Array(buffer);e.HEAP16=ta=new Int16Array(buffer);e.HEAP32=B=new Int32Array(buffer);e.HEAPU8=y=new Uint8Array(buffer);e.HEAPU16=new Uint16Array(buffer);e.HEAPU32=new Uint32Array(buffer);e.HEAPF32=new Float32Array(buffer);e.HEAPF64=new Float64Array(buffer)}var va,w,wa,xa,ya,za,Aa,C;va=w=xa=ya=za=Aa=C=0;wa=!1;
function Ba(){u("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value "+D+", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ")}var Ca=e.TOTAL_STACK||5242880,D=e.TOTAL_MEMORY||16777216;D<Ca&&v("TOTAL_MEMORY should be larger than TOTAL_STACK, was "+D+"! (TOTAL_STACK="+Ca+")");
e.buffer?buffer=e.buffer:("object"===typeof WebAssembly&&"function"===typeof WebAssembly.Memory?(e.wasmMemory=new WebAssembly.Memory({initial:D/65536,maximum:D/65536}),buffer=e.wasmMemory.buffer):buffer=new ArrayBuffer(D),e.buffer=buffer);ua();function Da(a){for(;0<a.length;){var b=a.shift();if("function"==typeof b)b();else{var c=b.Ca;"number"===typeof c?void 0===b.U?e.dynCall_v(c):e.dynCall_vi(c,b.U):c(void 0===b.U?null:b.U)}}}var Ea=[],Fa=[],Ga=[],Ha=[],Ia=[],Ja=!1;
function Ka(){var a=e.preRun.shift();Ea.unshift(a)}var E=0,La=null,F=null;function Ma(){E++;e.monitorRunDependencies&&e.monitorRunDependencies(E)}function Na(){E--;e.monitorRunDependencies&&e.monitorRunDependencies(E);if(0==E&&(null!==La&&(clearInterval(La),La=null),F)){var a=F;F=null;a()}}e.preloadedImages={};e.preloadedAudios={};function Oa(a){return String.prototype.startsWith?a.startsWith("data:application/octet-stream;base64,"):0===a.indexOf("data:application/octet-stream;base64,")}
(function(){function a(){try{if(e.wasmBinary)return new Uint8Array(e.wasmBinary);if(e.readBinary)return e.readBinary(f);throw"both async and sync fetching of the wasm failed";}catch(H){u(H)}}function b(){return e.wasmBinary||!n&&!q||"function"!==typeof fetch?new Promise(function(b){b(a())}):fetch(f,{credentials:"same-origin"}).then(function(a){if(!a.ok)throw"failed to load wasm binary file at '"+f+"'";return a.arrayBuffer()}).catch(function(){return a()})}function c(a){function c(a){m=a.exports;if(m.memory){a=
m.memory;var b=e.buffer;a.byteLength<b.byteLength&&v("the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here");b=new Int8Array(b);(new Int8Array(a)).set(b);e.buffer=buffer=a;ua()}e.asm=m;e.usingWasm=!0;Na()}function d(a){c(a.instance)}function g(a){b().then(function(a){return WebAssembly.instantiate(a,l)}).then(a,function(a){v("failed to asynchronously prepare wasm: "+a);u(a)})}if("object"!==typeof WebAssembly)return v("no native wasm support detected"),
!1;if(!(e.wasmMemory instanceof WebAssembly.Memory))return v("no native wasm Memory in use"),!1;a.memory=e.wasmMemory;l.global={NaN:NaN,Infinity:Infinity};l["global.Math"]=Math;l.env=a;Ma();if(e.instantiateWasm)try{return e.instantiateWasm(l,c)}catch(aa){return v("Module.instantiateWasm callback failed with error: "+aa),!1}e.wasmBinary||"function"!==typeof WebAssembly.instantiateStreaming||Oa(f)||"function"!==typeof fetch?g(d):WebAssembly.instantiateStreaming(fetch(f,{credentials:"same-origin"}),
l).then(d,function(a){v("wasm streaming compile failed: "+a);v("falling back to ArrayBuffer instantiation");g(d)});return{}}var d="sc68n.wast",f="sc68n.wasm",g="sc68n.temp.asm.js";Oa(d)||(d=ca(d));Oa(f)||(f=ca(f));Oa(g)||(g=ca(g));var l={global:null,env:null,asm2wasm:ja,parent:e},m=null;e.asmPreload=e.asm;var p=e.reallocBuffer;e.reallocBuffer=function(a){if("asmjs"===I)var b=p(a);else a:{var c=e.usingWasm?65536:16777216;0<a%c&&(a+=c-a%c);c=e.buffer.byteLength;if(e.usingWasm)try{b=-1!==e.wasmMemory.grow((a-
c)/65536)?e.buffer=e.wasmMemory.buffer:null;break a}catch(Zb){b=null;break a}b=void 0}return b};var I="";e.asm=function(a,b){if(!b.table){a=e.wasmTableSize;void 0===a&&(a=1024);var d=e.wasmMaxTableSize;b.table="object"===typeof WebAssembly&&"function"===typeof WebAssembly.Table?void 0!==d?new WebAssembly.Table({initial:a,maximum:d,element:"anyfunc"}):new WebAssembly.Table({initial:a,element:"anyfunc"}):Array(a);e.wasmTable=b.table}b.memoryBase||(b.memoryBase=e.STATIC_BASE);b.tableBase||(b.tableBase=
0);b=c(b);assert(b,"no binaryen method succeeded.");return b}})();va=1024;w=va+419936;Fa.push({Ca:function(){Pa()}});e.STATIC_BASE=va;e.STATIC_BUMP=419936;w+=16;
var G={F:1,v:2,yc:3,ub:4,B:5,fa:6,Na:7,Sb:8,u:9,ab:10,aa:11,Ic:11,va:12,P:13,nb:14,dc:15,R:16,ba:17,Jc:18,T:19,da:20,I:21,h:22,Nb:23,ua:24,C:25,Fc:26,ob:27,$b:28,M:29,vc:30,Gb:31,oc:32,kb:33,sc:34,Wb:42,rb:43,bb:44,xb:45,yb:46,zb:47,Fb:48,Gc:49,Qb:50,wb:51,hb:35,Tb:37,Ta:52,Wa:53,Kc:54,Ob:55,Xa:56,Ya:57,ib:35,Za:59,bc:60,Rb:61,Cc:62,ac:63,Xb:64,Yb:65,uc:66,Ub:67,Qa:68,zc:69,cb:70,pc:71,Ib:72,lb:73,Va:74,jc:76,Ua:77,tc:78,Ab:79,Bb:80,Eb:81,Db:82,Cb:83,cc:38,ea:39,Jb:36,S:40,kc:95,nc:96,gb:104,Pb:105,
Ra:97,rc:91,hc:88,Zb:92,wc:108,fb:111,Oa:98,eb:103,Mb:101,Kb:100,Dc:110,pb:112,qb:113,tb:115,Sa:114,jb:89,Hb:90,qc:93,xc:94,Pa:99,Lb:102,vb:106,ec:107,Ec:109,Hc:87,mb:122,Ac:116,ic:95,Vb:123,sb:84,lc:75,$a:125,fc:131,mc:130,Bc:86},Qa={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",
13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",
35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",
54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",
75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",
92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",
109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};function Ra(a){e.___errno_location&&(B[e.___errno_location()>>2]=a);return a}
function Sa(a,b){for(var c=0,d=a.length-1;0<=d;d--){var f=a[d];"."===f?a.splice(d,1):".."===f?(a.splice(d,1),c++):c&&(a.splice(d,1),c--)}if(b)for(;c;c--)a.unshift("..");return a}function Ta(a){var b="/"===a.charAt(0),c="/"===a.substr(-1);(a=Sa(a.split("/").filter(function(a){return!!a}),!b).join("/"))||b||(a=".");a&&c&&(a+="/");return(b?"/":"")+a}
function Ua(a){var b=/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(a).slice(1);a=b[0];b=b[1];if(!a&&!b)return".";b&&(b=b.substr(0,b.length-1));return a+b}function Va(a){if("/"===a)return"/";var b=a.lastIndexOf("/");return-1===b?a:a.substr(b+1)}function Wa(){var a=Array.prototype.slice.call(arguments,0);return Ta(a.join("/"))}function J(a,b){return Ta(a+"/"+b)}
function Xa(){for(var a="",b=!1,c=arguments.length-1;-1<=c&&!b;c--){b=0<=c?arguments[c]:"/";if("string"!==typeof b)throw new TypeError("Arguments to path.resolve must be strings");if(!b)return"";a=b+"/"+a;b="/"===b.charAt(0)}a=Sa(a.split("/").filter(function(a){return!!a}),!b).join("/");return(b?"/":"")+a||"."}var Ya=[];function Za(a,b){Ya[a]={input:[],output:[],H:b};$a(a,ab)}
var ab={open:function(a){var b=Ya[a.node.rdev];if(!b)throw new K(G.T);a.tty=b;a.seekable=!1},close:function(a){a.tty.H.flush(a.tty)},flush:function(a){a.tty.H.flush(a.tty)},read:function(a,b,c,d){if(!a.tty||!a.tty.H.oa)throw new K(G.fa);for(var f=0,g=0;g<d;g++){try{var l=a.tty.H.oa(a.tty)}catch(m){throw new K(G.B);}if(void 0===l&&0===f)throw new K(G.aa);if(null===l||void 0===l)break;f++;b[c+g]=l}f&&(a.node.timestamp=Date.now());return f},write:function(a,b,c,d){if(!a.tty||!a.tty.H.Z)throw new K(G.fa);
for(var f=0;f<d;f++)try{a.tty.H.Z(a.tty,b[c+f])}catch(g){throw new K(G.B);}d&&(a.node.timestamp=Date.now());return f}},cb={oa:function(a){if(!a.input.length){var b=null;if(r){var c=new Buffer(256),d=0,f=process.stdin.fd;if("win32"!=process.platform){var g=!1;try{f=fs.openSync("/dev/stdin","r"),g=!0}catch(l){}}try{d=fs.readSync(f,c,0,256,null)}catch(l){if(-1!=l.toString().indexOf("EOF"))d=0;else throw l;}g&&fs.closeSync(f);0<d?b=c.slice(0,d).toString("utf-8"):b=null}else"undefined"!=typeof window&&
"function"==typeof window.prompt?(b=window.prompt("Input: "),null!==b&&(b+="\n")):"function"==typeof readline&&(b=readline(),null!==b&&(b+="\n"));if(!b)return null;a.input=bb(b)}return a.input.shift()},Z:function(a,b){null===b||10===b?(fa(A(a.output,0)),a.output=[]):0!=b&&a.output.push(b)},flush:function(a){a.output&&0<a.output.length&&(fa(A(a.output,0)),a.output=[])}},db={Z:function(a,b){null===b||10===b?(v(A(a.output,0)),a.output=[]):0!=b&&a.output.push(b)},flush:function(a){a.output&&0<a.output.length&&
(v(A(a.output,0)),a.output=[])}},L={o:null,j:function(){return L.createNode(null,"/",16895,0)},createNode:function(a,b,c,d){if(24576===(c&61440)||4096===(c&61440))throw new K(G.F);L.o||(L.o={dir:{node:{s:L.c.s,i:L.c.i,lookup:L.c.lookup,J:L.c.J,rename:L.c.rename,unlink:L.c.unlink,rmdir:L.c.rmdir,readdir:L.c.readdir,symlink:L.c.symlink},stream:{A:L.f.A}},file:{node:{s:L.c.s,i:L.c.i},stream:{A:L.f.A,read:L.f.read,write:L.f.write,ga:L.f.ga,ra:L.f.ra,ta:L.f.ta}},link:{node:{s:L.c.s,i:L.c.i,readlink:L.c.readlink},
stream:{}},ja:{node:{s:L.c.s,i:L.c.i},stream:eb}});c=fb(a,b,c,d);M(c.mode)?(c.c=L.o.dir.node,c.f=L.o.dir.stream,c.b={}):32768===(c.mode&61440)?(c.c=L.o.file.node,c.f=L.o.file.stream,c.g=0,c.b=null):40960===(c.mode&61440)?(c.c=L.o.link.node,c.f=L.o.link.stream):8192===(c.mode&61440)&&(c.c=L.o.ja.node,c.f=L.o.ja.stream);c.timestamp=Date.now();a&&(a.b[b]=c);return c},Da:function(a){if(a.b&&a.b.subarray){for(var b=[],c=0;c<a.g;++c)b.push(a.b[c]);return b}return a.b},Oc:function(a){return a.b?a.b.subarray?
a.b.subarray(0,a.g):new Uint8Array(a.b):new Uint8Array},ka:function(a,b){a.b&&a.b.subarray&&b>a.b.length&&(a.b=L.Da(a),a.g=a.b.length);if(!a.b||a.b.subarray){var c=a.b?a.b.length:0;c>=b||(b=Math.max(b,c*(1048576>c?2:1.125)|0),0!=c&&(b=Math.max(b,256)),c=a.b,a.b=new Uint8Array(b),0<a.g&&a.b.set(c.subarray(0,a.g),0))}else for(!a.b&&0<b&&(a.b=[]);a.b.length<b;)a.b.push(0)},Ia:function(a,b){if(a.g!=b)if(0==b)a.b=null,a.g=0;else{if(!a.b||a.b.subarray){var c=a.b;a.b=new Uint8Array(new ArrayBuffer(b));c&&
a.b.set(c.subarray(0,Math.min(b,a.g)))}else if(a.b||(a.b=[]),a.b.length>b)a.b.length=b;else for(;a.b.length<b;)a.b.push(0);a.g=b}},c:{s:function(a){var b={};b.dev=8192===(a.mode&61440)?a.id:1;b.ino=a.id;b.mode=a.mode;b.nlink=1;b.uid=0;b.gid=0;b.rdev=a.rdev;M(a.mode)?b.size=4096:32768===(a.mode&61440)?b.size=a.g:40960===(a.mode&61440)?b.size=a.link.length:b.size=0;b.atime=new Date(a.timestamp);b.mtime=new Date(a.timestamp);b.ctime=new Date(a.timestamp);b.D=4096;b.blocks=Math.ceil(b.size/b.D);return b},
i:function(a,b){void 0!==b.mode&&(a.mode=b.mode);void 0!==b.timestamp&&(a.timestamp=b.timestamp);void 0!==b.size&&L.Ia(a,b.size)},lookup:function(){throw gb[G.v];},J:function(a,b,c,d){return L.createNode(a,b,c,d)},rename:function(a,b,c){if(M(a.mode)){try{var d=N(b,c)}catch(g){}if(d)for(var f in d.b)throw new K(G.ea);}delete a.parent.b[a.name];a.name=c;b.b[c]=a;a.parent=b},unlink:function(a,b){delete a.b[b]},rmdir:function(a,b){var c=N(a,b),d;for(d in c.b)throw new K(G.ea);delete a.b[b]},readdir:function(a){var b=
[".",".."],c;for(c in a.b)a.b.hasOwnProperty(c)&&b.push(c);return b},symlink:function(a,b,c){a=L.createNode(a,b,41471,0);a.link=c;return a},readlink:function(a){if(40960!==(a.mode&61440))throw new K(G.h);return a.link}},f:{read:function(a,b,c,d,f){var g=a.node.b;if(f>=a.node.g)return 0;a=Math.min(a.node.g-f,d);assert(0<=a);if(8<a&&g.subarray)b.set(g.subarray(f,f+a),c);else for(d=0;d<a;d++)b[c+d]=g[f+d];return a},write:function(a,b,c,d,f,g){if(!d)return 0;a=a.node;a.timestamp=Date.now();if(b.subarray&&
(!a.b||a.b.subarray)){if(g)return a.b=b.subarray(c,c+d),a.g=d;if(0===a.g&&0===f)return a.b=new Uint8Array(b.subarray(c,c+d)),a.g=d;if(f+d<=a.g)return a.b.set(b.subarray(c,c+d),f),d}L.ka(a,f+d);if(a.b.subarray&&b.subarray)a.b.set(b.subarray(c,c+d),f);else for(g=0;g<d;g++)a.b[f+g]=b[c+g];a.g=Math.max(a.g,f+d);return d},A:function(a,b,c){1===c?b+=a.position:2===c&&32768===(a.node.mode&61440)&&(b+=a.node.g);if(0>b)throw new K(G.h);return b},ga:function(a,b,c){L.ka(a.node,b+c);a.node.g=Math.max(a.node.g,
b+c)},ra:function(a,b,c,d,f,g,l){if(32768!==(a.node.mode&61440))throw new K(G.T);c=a.node.b;if(l&2||c.buffer!==b&&c.buffer!==b.buffer){if(0<f||f+d<a.node.g)c.subarray?c=c.subarray(f,f+d):c=Array.prototype.slice.call(c,f,f+d);a=!0;d=hb(d);if(!d)throw new K(G.va);b.set(c,d)}else a=!1,d=c.byteOffset;return{Qc:d,Lc:a}},ta:function(a,b,c,d,f){if(32768!==(a.node.mode&61440))throw new K(G.T);if(f&2)return 0;L.f.write(a,b,0,d,c,!1);return 0}}},O={O:!1,La:function(){O.O=!!process.platform.match(/^win/);var a=
process.binding("constants");a.fs&&(a=a.fs);O.la={1024:a.O_APPEND,64:a.O_CREAT,128:a.O_EXCL,0:a.O_RDONLY,2:a.O_RDWR,4096:a.O_SYNC,512:a.O_TRUNC,1:a.O_WRONLY}},ha:function(a){return Buffer.Nc?Buffer.from(a):new Buffer(a)},j:function(a){assert(r);return O.createNode(null,"/",O.na(a.Y.root),0)},createNode:function(a,b,c){if(!M(c)&&32768!==(c&61440)&&40960!==(c&61440))throw new K(G.h);a=fb(a,b,c);a.c=O.c;a.f=O.f;return a},na:function(a){try{var b=fs.lstatSync(a);O.O&&(b.mode=b.mode|(b.mode&292)>>2)}catch(c){if(!c.code)throw c;
throw new K(G[c.code]);}return b.mode},l:function(a){for(var b=[];a.parent!==a;)b.push(a.name),a=a.parent;b.push(a.j.Y.root);b.reverse();return Wa.apply(null,b)},Ba:function(a){a&=-2656257;var b=0,c;for(c in O.la)a&c&&(b|=O.la[c],a^=c);if(a)throw new K(G.h);return b},c:{s:function(a){a=O.l(a);try{var b=fs.lstatSync(a)}catch(c){if(!c.code)throw c;throw new K(G[c.code]);}O.O&&!b.D&&(b.D=4096);O.O&&!b.blocks&&(b.blocks=(b.size+b.D-1)/b.D|0);return{dev:b.dev,ino:b.ino,mode:b.mode,nlink:b.nlink,uid:b.uid,
gid:b.gid,rdev:b.rdev,size:b.size,atime:b.atime,mtime:b.mtime,ctime:b.ctime,D:b.D,blocks:b.blocks}},i:function(a,b){var c=O.l(a);try{void 0!==b.mode&&(fs.chmodSync(c,b.mode),a.mode=b.mode),void 0!==b.size&&fs.truncateSync(c,b.size)}catch(d){if(!d.code)throw d;throw new K(G[d.code]);}},lookup:function(a,b){var c=J(O.l(a),b);c=O.na(c);return O.createNode(a,b,c)},J:function(a,b,c,d){a=O.createNode(a,b,c,d);b=O.l(a);try{M(a.mode)?fs.mkdirSync(b,a.mode):fs.writeFileSync(b,"",{mode:a.mode})}catch(f){if(!f.code)throw f;
throw new K(G[f.code]);}return a},rename:function(a,b,c){a=O.l(a);b=J(O.l(b),c);try{fs.renameSync(a,b)}catch(d){if(!d.code)throw d;throw new K(G[d.code]);}},unlink:function(a,b){a=J(O.l(a),b);try{fs.unlinkSync(a)}catch(c){if(!c.code)throw c;throw new K(G[c.code]);}},rmdir:function(a,b){a=J(O.l(a),b);try{fs.rmdirSync(a)}catch(c){if(!c.code)throw c;throw new K(G[c.code]);}},readdir:function(a){a=O.l(a);try{return fs.readdirSync(a)}catch(b){if(!b.code)throw b;throw new K(G[b.code]);}},symlink:function(a,
b,c){a=J(O.l(a),b);try{fs.symlinkSync(c,a)}catch(d){if(!d.code)throw d;throw new K(G[d.code]);}},readlink:function(a){var b=O.l(a);try{return b=fs.readlinkSync(b),b=ib.relative(ib.resolve(a.j.Y.root),b)}catch(c){if(!c.code)throw c;throw new K(G[c.code]);}}},f:{open:function(a){var b=O.l(a.node);try{32768===(a.node.mode&61440)&&(a.L=fs.openSync(b,O.Ba(a.flags)))}catch(c){if(!c.code)throw c;throw new K(G[c.code]);}},close:function(a){try{32768===(a.node.mode&61440)&&a.L&&fs.closeSync(a.L)}catch(b){if(!b.code)throw b;
throw new K(G[b.code]);}},read:function(a,b,c,d,f){if(0===d)return 0;try{return fs.readSync(a.L,O.ha(b.buffer),c,d,f)}catch(g){throw new K(G[g.code]);}},write:function(a,b,c,d,f){try{return fs.writeSync(a.L,O.ha(b.buffer),c,d,f)}catch(g){throw new K(G[g.code]);}},A:function(a,b,c){if(1===c)b+=a.position;else if(2===c&&32768===(a.node.mode&61440))try{b+=fs.fstatSync(a.L).size}catch(d){throw new K(G[d.code]);}if(0>b)throw new K(G.h);return b}}};w+=16;w+=16;w+=16;
var kb=null,lb={},P=[],mb=1,Q=null,nb=!0,R={},K=null,gb={};
function S(a,b){a=Xa("/",a);b=b||{};if(!a)return{path:"",node:null};var c={ma:!0,$:0},d;for(d in c)void 0===b[d]&&(b[d]=c[d]);if(8<b.$)throw new K(G.S);a=Sa(a.split("/").filter(function(a){return!!a}),!1);var f=kb;c="/";for(d=0;d<a.length;d++){var g=d===a.length-1;if(g&&b.parent)break;f=N(f,a[d]);c=J(c,a[d]);f.K&&(!g||g&&b.ma)&&(f=f.K.root);if(!g||b.V)for(g=0;40960===(f.mode&61440);)if(f=ob(c),c=Xa(Ua(c),f),f=S(c,{$:b.$}).node,40<g++)throw new K(G.S);}return{path:c,node:f}}
function T(a){for(var b;;){if(a===a.parent)return a=a.j.sa,b?"/"!==a[a.length-1]?a+"/"+b:a+b:a;b=b?a.name+"/"+b:a.name;a=a.parent}}function pb(a,b){for(var c=0,d=0;d<b.length;d++)c=(c<<5)-c+b.charCodeAt(d)|0;return(a+c>>>0)%Q.length}function qb(a){var b=pb(a.parent.id,a.name);a.G=Q[b];Q[b]=a}function N(a,b){var c;if(c=(c=rb(a,"x"))?c:a.c.lookup?0:G.P)throw new K(c,a);for(c=Q[pb(a.id,b)];c;c=c.G){var d=c.name;if(c.parent.id===a.id&&d===b)return c}return a.c.lookup(a,b)}
function fb(a,b,c,d){sb||(sb=function(a,b,c,d){a||(a=this);this.parent=a;this.j=a.j;this.K=null;this.id=mb++;this.name=b;this.mode=c;this.c={};this.f={};this.rdev=d},sb.prototype={},Object.defineProperties(sb.prototype,{read:{get:function(){return 365===(this.mode&365)},set:function(a){a?this.mode|=365:this.mode&=-366}},write:{get:function(){return 146===(this.mode&146)},set:function(a){a?this.mode|=146:this.mode&=-147}},Ga:{get:function(){return M(this.mode)}},Fa:{get:function(){return 8192===(this.mode&
61440)}}}));a=new sb(a,b,c,d);qb(a);return a}function M(a){return 16384===(a&61440)}var tb={r:0,rs:1052672,"r+":2,w:577,wx:705,xw:705,"w+":578,"wx+":706,"xw+":706,a:1089,ax:1217,xa:1217,"a+":1090,"ax+":1218,"xa+":1218};function ub(a){var b=["r","w","rw"][a&3];a&512&&(b+="w");return b}function rb(a,b){if(nb)return 0;if(-1===b.indexOf("r")||a.mode&292){if(-1!==b.indexOf("w")&&!(a.mode&146)||-1!==b.indexOf("x")&&!(a.mode&73))return G.P}else return G.P;return 0}
function vb(a,b){try{return N(a,b),G.ba}catch(c){}return rb(a,"wx")}function wb(a){var b=4096;for(a=a||0;a<=b;a++)if(!P[a])return a;throw new K(G.ua);}function xb(a,b){yb||(yb=function(){},yb.prototype={},Object.defineProperties(yb.prototype,{object:{get:function(){return this.node},set:function(a){this.node=a}}}));var c=new yb,d;for(d in a)c[d]=a[d];a=c;b=wb(b);a.fd=b;return P[b]=a}var eb={open:function(a){a.f=lb[a.node.rdev].f;a.f.open&&a.f.open(a)},A:function(){throw new K(G.M);}};
function $a(a,b){lb[a]={f:b}}function zb(a,b){var c="/"===b,d=!b;if(c&&kb)throw new K(G.R);if(!c&&!d){var f=S(b,{ma:!1});b=f.path;f=f.node;if(f.K)throw new K(G.R);if(!M(f.mode))throw new K(G.da);}b={type:a,Y:{},sa:b,Ha:[]};a=a.j(b);a.j=b;b.root=a;c?kb=a:f&&(f.K=b,f.j&&f.j.Ha.push(b))}function Ab(a,b,c){var d=S(a,{parent:!0}).node;a=Va(a);if(!a||"."===a||".."===a)throw new K(G.h);var f=vb(d,a);if(f)throw new K(f);if(!d.c.J)throw new K(G.F);return d.c.J(d,a,b,c)}
function U(a,b){return Ab(a,(void 0!==b?b:511)&1023|16384,0)}function Bb(a,b,c){"undefined"===typeof c&&(c=b,b=438);return Ab(a,b|8192,c)}function Cb(a,b){if(!Xa(a))throw new K(G.v);var c=S(b,{parent:!0}).node;if(!c)throw new K(G.v);b=Va(b);var d=vb(c,b);if(d)throw new K(d);if(!c.c.symlink)throw new K(G.F);return c.c.symlink(c,b,a)}
function Db(a){var b=S(a,{parent:!0}).node,c=Va(a),d=N(b,c);a:{try{var f=N(b,c)}catch(l){f=l.m;break a}var g=rb(b,"wx");f=g?g:M(f.mode)?G.I:0}if(f)throw new K(f);if(!b.c.unlink)throw new K(G.F);if(d.K)throw new K(G.R);try{R.willDeletePath&&R.willDeletePath(a)}catch(l){console.log("FS.trackingDelegate['willDeletePath']('"+a+"') threw an exception: "+l.message)}b.c.unlink(b,c);b=pb(d.parent.id,d.name);if(Q[b]===d)Q[b]=d.G;else for(b=Q[b];b;){if(b.G===d){b.G=d.G;break}b=b.G}try{if(R.onDeletePath)R.onDeletePath(a)}catch(l){console.log("FS.trackingDelegate['onDeletePath']('"+
a+"') threw an exception: "+l.message)}}function ob(a){a=S(a).node;if(!a)throw new K(G.v);if(!a.c.readlink)throw new K(G.h);return Xa(T(a.parent),a.c.readlink(a))}function Eb(a,b){var c;"string"===typeof a?c=S(a,{V:!0}).node:c=a;if(!c.c.i)throw new K(G.F);c.c.i(c,{mode:b&4095|c.mode&-4096,timestamp:Date.now()})}
function V(a,b,c,d){if(""===a)throw new K(G.v);if("string"===typeof b){var f=tb[b];if("undefined"===typeof f)throw Error("Unknown file open mode: "+b);b=f}c=b&64?("undefined"===typeof c?438:c)&4095|32768:0;if("object"===typeof a)var g=a;else{a=Ta(a);try{g=S(a,{V:!(b&131072)}).node}catch(p){}}f=!1;if(b&64)if(g){if(b&128)throw new K(G.ba);}else g=Ab(a,c,0),f=!0;if(!g)throw new K(G.v);8192===(g.mode&61440)&&(b&=-513);if(b&65536&&!M(g.mode))throw new K(G.da);if(!f){var l=g?40960===(g.mode&61440)?G.S:
M(g.mode)&&("r"!==ub(b)||b&512)?G.I:rb(g,ub(b)):G.v;if(l)throw new K(l);}if(b&512){c=g;var m;"string"===typeof c?m=S(c,{V:!0}).node:m=c;if(!m.c.i)throw new K(G.F);if(M(m.mode))throw new K(G.I);if(32768!==(m.mode&61440))throw new K(G.h);if(c=rb(m,"w"))throw new K(c);m.c.i(m,{size:0,timestamp:Date.now()})}b&=-641;d=xb({node:g,path:T(g),flags:b,seekable:!0,position:0,f:g.f,Ma:[],error:!1},d);d.f.open&&d.f.open(d);!e.logReadFiles||b&1||(Fb||(Fb={}),a in Fb||(Fb[a]=1,l("read file: "+a)));try{R.onOpenFile&&
(l=0,1!==(b&2097155)&&(l|=1),0!==(b&2097155)&&(l|=2),R.onOpenFile(a,l))}catch(p){console.log("FS.trackingDelegate['onOpenFile']('"+a+"', flags) threw an exception: "+p.message)}return d}function Gb(a){if(null===a.fd)throw new K(G.u);a.W&&(a.W=null);try{a.f.close&&a.f.close(a)}catch(b){throw b;}finally{P[a.fd]=null}a.fd=null}function Hb(a,b,c){if(null===a.fd)throw new K(G.u);if(!a.seekable||!a.f.A)throw new K(G.M);a.position=a.f.A(a,b,c);a.Ma=[]}
function Ib(a,b,c,d){var f=x;if(0>c||0>d)throw new K(G.h);if(null===a.fd)throw new K(G.u);if(1===(a.flags&2097155))throw new K(G.u);if(M(a.node.mode))throw new K(G.I);if(!a.f.read)throw new K(G.h);var g="undefined"!==typeof d;if(!g)d=a.position;else if(!a.seekable)throw new K(G.M);b=a.f.read(a,f,b,c,d);g||(a.position+=b);return b}
function Jb(a,b,c,d,f,g){if(0>d||0>f)throw new K(G.h);if(null===a.fd)throw new K(G.u);if(0===(a.flags&2097155))throw new K(G.u);if(M(a.node.mode))throw new K(G.I);if(!a.f.write)throw new K(G.h);a.flags&1024&&Hb(a,0,2);var l="undefined"!==typeof f;if(!l)f=a.position;else if(!a.seekable)throw new K(G.M);b=a.f.write(a,b,c,d,f,g);l||(a.position+=b);try{if(a.path&&R.onWriteToFile)R.onWriteToFile(a.path)}catch(m){console.log("FS.trackingDelegate['onWriteToFile']('"+path+"') threw an exception: "+m.message)}return b}
function Kb(){K||(K=function(a,b){this.node=b;this.Ka=function(a){this.m=a;for(var b in G)if(G[b]===a){this.code=b;break}};this.Ka(a);this.message=Qa[a];this.stack&&Object.defineProperty(this,"stack",{value:Error().stack,writable:!0})},K.prototype=Error(),K.prototype.constructor=K,[G.v].forEach(function(a){gb[a]=new K(a);gb[a].stack="<generic error, no stack>"}))}var Lb;function Mb(a,b){var c=0;a&&(c|=365);b&&(c|=146);return c}
function Nb(a,b,c,d){a=J("string"===typeof a?a:T(a),b);return U(a,Mb(c,d))}function Ob(a,b){a="string"===typeof a?a:T(a);for(b=b.split("/").reverse();b.length;){var c=b.pop();if(c){var d=J(a,c);try{U(d)}catch(f){}a=d}}return d}function Pb(a,b,c,d){a=J("string"===typeof a?a:T(a),b);c=Mb(c,d);return Ab(a,(void 0!==c?c:438)&4095|32768,0)}
function Qb(a,b,c,d,f,g){a=b?J("string"===typeof a?a:T(a),b):a;d=Mb(d,f);f=Ab(a,(void 0!==d?d:438)&4095|32768,0);if(c){if("string"===typeof c){a=Array(c.length);b=0;for(var l=c.length;b<l;++b)a[b]=c.charCodeAt(b);c=a}Eb(f,d|146);a=V(f,"w");Jb(a,c,0,c.length,0,g);Gb(a);Eb(f,d)}return f}
function W(a,b,c,d){a=J("string"===typeof a?a:T(a),b);b=Mb(!!c,!!d);W.qa||(W.qa=64);var f=W.qa++<<8|0;$a(f,{open:function(a){a.seekable=!1},close:function(){d&&d.buffer&&d.buffer.length&&d(10)},read:function(a,b,d,f){for(var g=0,l=0;l<f;l++){try{var m=c()}catch(Yb){throw new K(G.B);}if(void 0===m&&0===g)throw new K(G.aa);if(null===m||void 0===m)break;g++;b[d+l]=m}g&&(a.node.timestamp=Date.now());return g},write:function(a,b,c,f){for(var g=0;g<f;g++)try{d(b[c+g])}catch(H){throw new K(G.B);}f&&(a.node.timestamp=
Date.now());return g}});return Bb(a,b,f)}function Rb(a,b,c){a=J("string"===typeof a?a:T(a),b);return Cb(c,a)}
function Sb(a){if(a.Fa||a.Ga||a.link||a.b)return!0;var b=!0;if("undefined"!==typeof XMLHttpRequest)throw Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");if(e.read)try{a.b=bb(e.read(a.url)),a.g=a.b.length}catch(c){b=!1}else throw Error("Cannot load without read() or XMLHttpRequest.");b||Ra(G.B);return b}
function Tb(a,b,c,d,f){function g(){this.X=!1;this.N=[]}g.prototype.get=function(a){if(!(a>this.length-1||0>a)){var b=a%this.chunkSize;return this.pa(a/this.chunkSize|0)[b]}};g.prototype.Ja=function(a){this.pa=a};g.prototype.ia=function(){var a=new XMLHttpRequest;a.open("HEAD",c,!1);a.send(null);if(!(200<=a.status&&300>a.status||304===a.status))throw Error("Couldn't load "+c+". Status: "+a.status);var b=Number(a.getResponseHeader("Content-length")),d,f=(d=a.getResponseHeader("Accept-Ranges"))&&"bytes"===
d;a=(d=a.getResponseHeader("Content-Encoding"))&&"gzip"===d;var g=1048576;f||(g=b);var l=this;l.Ja(function(a){var d=a*g,f=(a+1)*g-1;f=Math.min(f,b-1);if("undefined"===typeof l.N[a]){var m=l.N;if(d>f)throw Error("invalid range ("+d+", "+f+") or no bytes requested!");if(f>b-1)throw Error("only "+b+" bytes available! programmer error!");var p=new XMLHttpRequest;p.open("GET",c,!1);b!==g&&p.setRequestHeader("Range","bytes="+d+"-"+f);"undefined"!=typeof Uint8Array&&(p.responseType="arraybuffer");p.overrideMimeType&&
p.overrideMimeType("text/plain; charset=x-user-defined");p.send(null);if(!(200<=p.status&&300>p.status||304===p.status))throw Error("Couldn't load "+c+". Status: "+p.status);d=void 0!==p.response?new Uint8Array(p.response||[]):bb(p.responseText||"");m[a]=d}if("undefined"===typeof l.N[a])throw Error("doXHR failed!");return l.N[a]});if(a||!b)g=b=1,g=b=this.pa(0).length,console.log("LazyFiles on gzip forces download of the whole file when length is accessed");this.ya=b;this.wa=g;this.X=!0};if("undefined"!==
typeof XMLHttpRequest){if(!q)throw"Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";var l=new g;Object.defineProperties(l,{length:{get:function(){this.X||this.ia();return this.ya}},chunkSize:{get:function(){this.X||this.ia();return this.wa}}});var m=void 0}else m=c,l=void 0;var p=Pb(a,b,d,f);l?p.b=l:m&&(p.b=null,p.url=m);Object.defineProperties(p,{g:{get:function(){return this.b.length}}});var I={};Object.keys(p.f).forEach(function(a){var b=
p.f[a];I[a]=function(){if(!Sb(p))throw new K(G.B);return b.apply(null,arguments)}});I.read=function(a,b,c,d,f){if(!Sb(p))throw new K(G.B);a=a.node.b;if(f>=a.length)return 0;d=Math.min(a.length-f,d);assert(0<=d);if(a.slice)for(var g=0;g<d;g++)b[c+g]=a[f+g];else for(g=0;g<d;g++)b[c+g]=a.get(f+g);return d};p.f=I;return p}
function Ub(a,b,c,d,f,g,l,m,p,I){function H(c){function H(c){I&&I();m||Qb(a,b,c,d,f,p);g&&g();Na()}var aa=!1;e.preloadPlugins.forEach(function(a){!aa&&a.canHandle(jb)&&(a.handle(c,jb,H,function(){l&&l();Na()}),aa=!0)});aa||H(c)}Browser.Pc();var jb=b?Xa(J(a,b)):a;Ma();"string"==typeof c?Browser.Mc(c,function(a){H(a)},l):H(c)}var FS={},sb,yb,Fb,X=0;function Y(){X+=4;return B[X-4>>2]}function Z(){var a=P[Y()];if(!a)throw new K(G.u);return a}Kb();Q=Array(4096);zb(L,"/");U("/tmp");U("/home");U("/home/web_user");
(function(){U("/dev");$a(259,{read:function(){return 0},write:function(a,b,f,g){return g}});Bb("/dev/null",259);Za(1280,cb);Za(1536,db);Bb("/dev/tty",1280);Bb("/dev/tty1",1536);if("undefined"!==typeof crypto){var a=new Uint8Array(1);var b=function(){crypto.getRandomValues(a);return a[0]}}else r?b=function(){return require("crypto").randomBytes(1)[0]}:b=function(){u("random_device")};W("/dev","random",b);W("/dev","urandom",b);U("/dev/shm");U("/dev/shm/tmp")})();U("/proc");U("/proc/self");U("/proc/self/fd");
zb({j:function(){var a=fb("/proc/self","fd",16895,73);a.c={lookup:function(a,c){var b=P[+c];if(!b)throw new K(G.u);a={parent:null,j:{sa:"fake"},c:{readlink:function(){return b.path}}};return a.parent=a}};return a}},"/proc/self/fd");
Fa.unshift(function(){if(!e.noFSInit&&!Lb){assert(!Lb,"FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");Lb=!0;Kb();e.stdin=e.stdin;e.stdout=e.stdout;e.stderr=e.stderr;e.stdin?W("/dev","stdin",e.stdin):Cb("/dev/tty","/dev/stdin");e.stdout?W("/dev","stdout",null,e.stdout):Cb("/dev/tty","/dev/stdout");e.stderr?W("/dev","stderr",null,e.stderr):Cb("/dev/tty1","/dev/stderr");var a=
V("/dev/stdin","r");assert(0===a.fd,"invalid handle for stdin ("+a.fd+")");a=V("/dev/stdout","w");assert(1===a.fd,"invalid handle for stdout ("+a.fd+")");a=V("/dev/stderr","w");assert(2===a.fd,"invalid handle for stderr ("+a.fd+")")}});Ga.push(function(){nb=!1});Ha.push(function(){Lb=!1;var a=e._fflush;a&&a(0);for(a=0;a<P.length;a++){var b=P[a];b&&Gb(b)}});e.FS_createFolder=Nb;e.FS_createPath=Ob;e.FS_createDataFile=Qb;e.FS_createPreloadedFile=Ub;e.FS_createLazyFile=Tb;e.FS_createLink=Rb;
e.FS_createDevice=W;e.FS_unlink=Db;Fa.unshift(function(){});Ha.push(function(){});if(r){var fs=require("fs"),ib=require("path");O.La()}C=ha(4);xa=ya=ia(w);za=xa+Ca;Aa=ia(za);B[C>>2]=Aa;wa=!0;function bb(a){for(var b=0,c=0;c<a.length;++c){var d=a.charCodeAt(c);55296<=d&&57343>=d&&(d=65536+((d&1023)<<10)|a.charCodeAt(++c)&1023);127>=d?++b:b=2047>=d?b+2:65535>=d?b+3:2097151>=d?b+4:67108863>=d?b+5:b+6}b=Array(b+1);a=oa(a,b,0,b.length);b.length=a;return b}e.wasmTableSize=1714;e.wasmMaxTableSize=1714;
e.za={};
e.Aa={abort:u,enlargeMemory:function(){Ba()},getTotalMemory:function(){return D},abortOnCannotGrowMemory:Ba,___assert_fail:function(a,b,c,d){u("Assertion failed: "+z(a)+", at: "+[b?z(b):"unknown filename",c,d?z(d):"unknown function"])},___lock:function(){},___setErrNo:Ra,___syscall140:function(a,b){X=b;try{var c=Z();Y();var d=Y(),f=Y(),g=Y();Hb(c,d,g);B[f>>2]=c.position;c.W&&0===d&&0===g&&(c.W=null);return 0}catch(l){return"undefined"!==typeof FS&&l instanceof K||u(l),-l.m}},___syscall145:function(a,b){X=
b;try{var c=Z(),d=Y();a:{var f=Y();for(b=a=0;b<f;b++){var g=B[d+(8*b+4)>>2],l=Ib(c,B[d+8*b>>2],g,void 0);if(0>l){var m=-1;break a}a+=l;if(l<g)break}m=a}return m}catch(p){return"undefined"!==typeof FS&&p instanceof K||u(p),-p.m}},___syscall146:function(a,b){X=b;try{var c=Z(),d=Y();a:{var f=Y();for(b=a=0;b<f;b++){var g=Jb(c,x,B[d+8*b>>2],B[d+(8*b+4)>>2],void 0);if(0>g){var l=-1;break a}a+=g}l=a}return l}catch(m){return"undefined"!==typeof FS&&m instanceof K||u(m),-m.m}},___syscall221:function(a,b){X=
b;try{var c=Z();switch(Y()){case 0:var d=Y();return 0>d?-G.h:V(c.path,c.flags,0,d).fd;case 1:case 2:return 0;case 3:return c.flags;case 4:return d=Y(),c.flags|=d,0;case 12:case 12:return d=Y(),ta[d+0>>1]=2,0;case 13:case 14:case 13:case 14:return 0;case 16:case 8:return-G.h;case 9:return Ra(G.h),-1;default:return-G.h}}catch(f){return"undefined"!==typeof FS&&f instanceof K||u(f),-f.m}},___syscall3:function(a,b){X=b;try{var c=Z(),d=Y(),f=Y();return Ib(c,d,f)}catch(g){return"undefined"!==typeof FS&&
g instanceof K||u(g),-g.m}},___syscall4:function(a,b){X=b;try{var c=Z(),d=Y(),f=Y();return Jb(c,x,d,f)}catch(g){return"undefined"!==typeof FS&&g instanceof K||u(g),-g.m}},___syscall5:function(a,b){X=b;try{var c=z(Y()),d=Y(),f=Y();return V(c,d,f).fd}catch(g){return"undefined"!==typeof FS&&g instanceof K||u(g),-g.m}},___syscall54:function(a,b){X=b;try{var c=Z(),d=Y();switch(d){case 21509:case 21505:return c.tty?0:-G.C;case 21510:case 21511:case 21512:case 21506:case 21507:case 21508:return c.tty?0:
-G.C;case 21519:if(!c.tty)return-G.C;var f=Y();return B[f>>2]=0;case 21520:return c.tty?-G.h:-G.C;case 21531:a=f=Y();if(!c.f.Ea)throw new K(G.C);return c.f.Ea(c,d,a);case 21523:return c.tty?0:-G.C;case 21524:return c.tty?0:-G.C;default:u("bad ioctl syscall "+d)}}catch(g){return"undefined"!==typeof FS&&g instanceof K||u(g),-g.m}},___syscall6:function(a,b){X=b;try{var c=Z();Gb(c);return 0}catch(d){return"undefined"!==typeof FS&&d instanceof K||u(d),-d.m}},___unlock:function(){},_ems_request_file:function(a){var b=
window.ScriptNodePlayer.getInstance();if(b.isReady())return b._fileRequestCallback(a);window.console.log("error: ems_request_file not ready")},_emscripten_memcpy_big:function(a,b,c){y.set(y.subarray(b,b+c),a);return a},DYNAMICTOP_PTR:C,STACKTOP:ya};var Vb=e.asm(e.za,e.Aa,buffer);e.asm=Vb;var Pa=e.__GLOBAL__sub_I_Adapter_cpp=function(){return e.asm.__GLOBAL__sub_I_Adapter_cpp.apply(null,arguments)};e.___errno_location=function(){return e.asm.___errno_location.apply(null,arguments)};
e._emu_compute_audio_samples=function(){return e.asm._emu_compute_audio_samples.apply(null,arguments)};e._emu_get_audio_buffer=function(){return e.asm._emu_get_audio_buffer.apply(null,arguments)};e._emu_get_audio_buffer_length=function(){return e.asm._emu_get_audio_buffer_length.apply(null,arguments)};e._emu_get_current_position=function(){return e.asm._emu_get_current_position.apply(null,arguments)};e._emu_get_hw_label=function(){return e.asm._emu_get_hw_label.apply(null,arguments)};
e._emu_get_max_position=function(){return e.asm._emu_get_max_position.apply(null,arguments)};e._emu_get_sample_rate=function(){return e.asm._emu_get_sample_rate.apply(null,arguments)};e._emu_get_trace_streams=function(){return e.asm._emu_get_trace_streams.apply(null,arguments)};e._emu_get_track_info=function(){return e.asm._emu_get_track_info.apply(null,arguments)};e._emu_load_file=function(){return e.asm._emu_load_file.apply(null,arguments)};
e._emu_number_trace_streams=function(){return e.asm._emu_number_trace_streams.apply(null,arguments)};e._emu_seek_position=function(){return e.asm._emu_seek_position.apply(null,arguments)};e._emu_set_loop_mode=function(){return e.asm._emu_set_loop_mode.apply(null,arguments)};e._emu_set_subsong=function(){return e.asm._emu_set_subsong.apply(null,arguments)};e._emu_teardown=function(){return e.asm._emu_teardown.apply(null,arguments)};e._free=function(){return e.asm._free.apply(null,arguments)};
var hb=e._malloc=function(){return e.asm._malloc.apply(null,arguments)},na=e.stackAlloc=function(){return e.asm.stackAlloc.apply(null,arguments)},ma=e.stackRestore=function(){return e.asm.stackRestore.apply(null,arguments)},la=e.stackSave=function(){return e.asm.stackSave.apply(null,arguments)};e.dynCall_v=function(){return e.asm.dynCall_v.apply(null,arguments)};e.dynCall_vi=function(){return e.asm.dynCall_vi.apply(null,arguments)};e.asm=Vb;
e.ccall=function(a,b,c,d){var f=e["_"+a];assert(f,"Cannot call unknown function "+a+", make sure it is exported");var g=[];a=0;if(d)for(var l=0;l<d.length;l++){var m=qa[c[l]];m?(0===a&&(a=la()),g[l]=m(d[l])):g[l]=d[l]}c=f.apply(null,g);c="string"===b?z(c):"boolean"===b?!!c:c;0!==a&&ma(a);return c};e.getMemory=function(a){if(wa)if(Ja)var b=hb(a);else{b=B[C>>2];a=b+a+15&-16;B[C>>2]=a;if(a=a>=D)Ba(),a=!0;a&&(B[C>>2]=b,b=0)}else b=ha(a);return b};e.Pointer_stringify=z;e.UTF8ToString=ra;
e.addRunDependency=Ma;e.removeRunDependency=Na;e.FS_createFolder=Nb;e.FS_createPath=Ob;e.FS_createDataFile=Qb;e.FS_createPreloadedFile=Ub;e.FS_createLazyFile=Tb;e.FS_createLink=Rb;e.FS_createDevice=W;e.FS_unlink=Db;F=function Wb(){e.calledRun||Xb();e.calledRun||(F=Wb)};
function Xb(){function a(){if(!e.calledRun&&(e.calledRun=!0,!ka)){Ja||(Ja=!0,Da(Fa));Da(Ga);if(e.onRuntimeInitialized)e.onRuntimeInitialized();if(e.postRun)for("function"==typeof e.postRun&&(e.postRun=[e.postRun]);e.postRun.length;){var a=e.postRun.shift();Ia.unshift(a)}Da(Ia)}}if(!(0<E)){if(e.preRun)for("function"==typeof e.preRun&&(e.preRun=[e.preRun]);e.preRun.length;)Ka();Da(Ea);0<E||e.calledRun||(e.setStatus?(e.setStatus("Running..."),setTimeout(function(){setTimeout(function(){e.setStatus("")},
1);a()},1)):a())}}e.run=Xb;function u(a){if(e.onAbort)e.onAbort(a);void 0!==a?(fa(a),v(a),a=JSON.stringify(a)):a="";ka=!0;throw"abort("+a+"). Build with -s ASSERTIONS=1 for more info.";}e.abort=u;if(e.preInit)for("function"==typeof e.preInit&&(e.preInit=[e.preInit]);0<e.preInit.length;)e.preInit.pop()();e.noExitRuntime=!0;Xb();
  return {
	Module: Module,  // expose original Module
  };
})(window.spp_backend_state_SC68n);
/*
 sc68_adapter.js: Adapts SC68 backend to generic WebAudio/ScriptProcessor player.

   version 1.1
   copyright (C) 2023 Juergen Wothke

 LICENSE

 This library is free software; you can redistribute it and/or modify it
 under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 2.1 of the License, or (at
 your option) any later version. This library is distributed in the hope
 that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
 warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public
 License along with this library; if not, write to the Free Software
 Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA
*/

class SC68BackendAdapter2 extends EmsHEAP16BackendAdapter {
	constructor(allowLoop)
	{
		super(backend_SC68n.Module, 2,
						new SimpleFileMapper(backend_SC68n.Module),
						new HEAP16ScopeProvider(backend_SC68n.Module, 0x8000));

		this._allowLoop = (typeof allowLoop != 'undefined') ? allowLoop : 0;

		this.ensureReadyNotification();
	}

	loadMusicData(sampleRate, path, filename, data, options)
	{
		this.Module.ccall('emu_set_loop_mode', 'number', ['number'], [this._allowLoop]);

		filename = this._getFilename(path, filename);

		let ret = this._loadMusicDataBuffer(filename, data, ScriptNodePlayer.getWebAudioSampleRate(), 1024, this._scopeEnabled);

		if (ret == 0)
		{
			this._setupOutputResampling(sampleRate);
		}
		return ret;
	}

	evalTrackOptions(options)
	{
		super.evalTrackOptions(options);

		let track = (typeof options.track != 'undefined') ?  options.track : -1;	// frontend counts from 0

		// sc68 starts counting at 1 (-1 means default)
		// for sc68 "0" means "all".. 	which is unused here

		if (track != -1) track += 1;

		return this.Module.ccall('emu_set_subsong', 'number', ['number'], [track]);
	}

	getSongInfoMeta()
	{
		return {
			title: String,
			album: String,
			artist: String,
			genre: String,
			format: String,
			track: Number,
			numberOfTracks: Number
		};
	}

	updateSongInfo(filename)
	{
		let result = this._songInfo;
		
		let numAttr= 7;
		let ret = this.Module.ccall('emu_get_track_info', 'number', [], []);

		let array = this.Module.HEAP32.subarray(ret>>2, (ret>>2)+numAttr);
		result.title = this.Module.Pointer_stringify(array[0]);
		result.album = this.Module.Pointer_stringify(array[1]);
		result.artist = this.Module.Pointer_stringify(array[2]);
		result.genre = this.Module.Pointer_stringify(array[3]);
		result.format = this.Module.Pointer_stringify(array[4]);
		result.track = parseInt(this.Module.Pointer_stringify(array[5]));
		result.numberOfTracks = parseInt(this.Module.Pointer_stringify(array[6]));
	}

	getHardwareLabel()
	{
		if (!this.isAdapterReady()) return "not ready";
		return this.Module.Pointer_stringify(this.Module.ccall('emu_get_hw_label', 'number'))
	}

	setLoopMode(allowLoop)
	{
		this._allowLoop = allowLoop;
	}

	getSongLength()
	{
		if (!this.isAdapterReady()) return -1;

		let numAttr = 7;
		ret = this.Module.ccall('emu_get_track_info', 'number', [], []);
		let array = this.Module.HEAP32.subarray(ret>>2, (ret>>2)+numAttr);
		return parseInt(this.Module.Pointer_stringify(array[5]));
	}
};


/* <wrapper> */
return createCodecPlayer(ScriptNodePlayer, SC68BackendAdapter2);
}
/* </wrapper> */
