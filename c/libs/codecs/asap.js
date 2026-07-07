
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
window.spp_backend_state_ASAP= {
	locateFile: function(path, scriptDirectory) { return (typeof window.WASM_SEARCH_PATH == 'undefined') ? path : window.WASM_SEARCH_PATH + path; },
	notReady: true,
	/* <wrapper> */...options,/* </wrapper> */
	adapterCallback: function(){}	// overwritten later	
};
window.spp_backend_state_ASAP["onRuntimeInitialized"] = function() {	// emscripten callback needed in case async init is used (e.g. for WASM)
	this.notReady= false;
	this.adapterCallback();
}.bind(window.spp_backend_state_ASAP);

var backend_ASAP = (function(Module) {var a;a||(a=typeof Module !== 'undefined' ? Module : {});var l={},m;for(m in a)a.hasOwnProperty(m)&&(l[m]=a[m]);a.arguments=[];a.thisProgram="./this.program";a.quit=function(b,d){throw d;};a.preRun=[];a.postRun=[];var n=!1,p=!1,q=!1,r=!1;n="object"===typeof window;p="function"===typeof importScripts;q="object"===typeof process&&"function"===typeof require&&!n&&!p;r=!n&&!q&&!p;var t="";function u(b){return a.locateFile?a.locateFile(b,t):t+b}
if(q){t=__dirname+"/";var v,w;a.read=function(b,d){v||(v=require("fs"));w||(w=require("path"));b=w.normalize(b);b=v.readFileSync(b);return d?b:b.toString()};a.readBinary=function(b){b=a.read(b,!0);b.buffer||(b=new Uint8Array(b));assert(b.buffer);return b};1<process.argv.length&&(a.thisProgram=process.argv[1].replace(/\\/g,"/"));a.arguments=process.argv.slice(2);"undefined"!==typeof module&&(module.exports=a);process.on("uncaughtException",function(b){throw b;});process.on("unhandledRejection",x);
a.quit=function(b){process.exit(b)};a.inspect=function(){return"[Emscripten Module object]"}}else if(r)"undefined"!=typeof read&&(a.read=function(b){return read(b)}),a.readBinary=function(b){if("function"===typeof readbuffer)return new Uint8Array(readbuffer(b));b=read(b,"binary");assert("object"===typeof b);return b},"undefined"!=typeof scriptArgs?a.arguments=scriptArgs:"undefined"!=typeof arguments&&(a.arguments=arguments),"function"===typeof quit&&(a.quit=function(b){quit(b)});else if(n||p)p?t=
self.location.href:document.currentScript&&(t=document.currentScript.src),t=0!==t.indexOf("blob:")?t.substr(0,t.lastIndexOf("/")+1):"",a.read=function(b){var d=new XMLHttpRequest;d.open("GET",b,!1);d.send(null);return d.responseText},p&&(a.readBinary=function(b){var d=new XMLHttpRequest;d.open("GET",b,!1);d.responseType="arraybuffer";d.send(null);return new Uint8Array(d.response)}),a.readAsync=function(b,d,e){var c=new XMLHttpRequest;c.open("GET",b,!0);c.responseType="arraybuffer";c.onload=function(){200==
c.status||0==c.status&&c.response?d(c.response):e()};c.onerror=e;c.send(null)},a.setWindowTitle=function(b){document.title=b};var y=a.print||("undefined"!==typeof console?console.log.bind(console):"undefined"!==typeof print?print:null),z=a.printErr||("undefined"!==typeof printErr?printErr:"undefined"!==typeof console&&console.warn.bind(console)||y);for(m in l)l.hasOwnProperty(m)&&(a[m]=l[m]);l=void 0;function A(b){var d;d||(d=16);return Math.ceil(b/d)*d}
var aa={"f64-rem":function(b,d){return b%d},"debugger":function(){debugger}},B=!1;function assert(b,d){b||x("Assertion failed: "+d)}
var I={stackSave:function(){C()},stackRestore:function(){D()},arrayToC:function(b){var d=E(b.length);F.set(b,d);return d},stringToC:function(b){var d=0;if(null!==b&&void 0!==b&&0!==b){var e=(b.length<<2)+1;d=E(e);var c=d,g=G;if(0<e){e=c+e-1;for(var h=0;h<b.length;++h){var f=b.charCodeAt(h);if(55296<=f&&57343>=f){var k=b.charCodeAt(++h);f=65536+((f&1023)<<10)|k&1023}if(127>=f){if(c>=e)break;g[c++]=f}else{if(2047>=f){if(c+1>=e)break;g[c++]=192|f>>6}else{if(65535>=f){if(c+2>=e)break;g[c++]=224|f>>12}else{if(2097151>=
f){if(c+3>=e)break;g[c++]=240|f>>18}else{if(67108863>=f){if(c+4>=e)break;g[c++]=248|f>>24}else{if(c+5>=e)break;g[c++]=252|f>>30;g[c++]=128|f>>24&63}g[c++]=128|f>>18&63}g[c++]=128|f>>12&63}g[c++]=128|f>>6&63}g[c++]=128|f&63}}g[c]=0}}return d}},ba={string:I.stringToC,array:I.arrayToC};
function J(b,d){if(0===d||!b)return"";for(var e=0,c,g=0;;){c=G[b+g>>0];e|=c;if(0==c&&!d)break;g++;if(d&&g==d)break}d||(d=g);c="";if(128>e){for(;0<d;)e=String.fromCharCode.apply(String,G.subarray(b,b+Math.min(d,1024))),c=c?c+e:e,b+=1024,d-=1024;return c}a:{d=G;for(e=b;d[e];)++e;if(16<e-b&&d.subarray&&ca)b=ca.decode(d.subarray(b,e));else for(e="";;){c=d[b++];if(!c){b=e;break a}if(c&128)if(g=d[b++]&63,192==(c&224))e+=String.fromCharCode((c&31)<<6|g);else{var h=d[b++]&63;if(224==(c&240))c=(c&15)<<12|
g<<6|h;else{var f=d[b++]&63;if(240==(c&248))c=(c&7)<<18|g<<12|h<<6|f;else{var k=d[b++]&63;if(248==(c&252))c=(c&3)<<24|g<<18|h<<12|f<<6|k;else{var H=d[b++]&63;c=(c&1)<<30|g<<24|h<<18|f<<12|k<<6|H}}}65536>c?e+=String.fromCharCode(c):(c-=65536,e+=String.fromCharCode(55296|c>>10,56320|c&1023))}else e+=String.fromCharCode(c)}}return b}var ca="undefined"!==typeof TextDecoder?new TextDecoder("utf8"):void 0;"undefined"!==typeof TextDecoder&&new TextDecoder("utf-16le");var buffer,F,G,K;
function da(){a.HEAP8=F=new Int8Array(buffer);a.HEAP16=new Int16Array(buffer);a.HEAP32=K=new Int32Array(buffer);a.HEAPU8=G=new Uint8Array(buffer);a.HEAPU16=new Uint16Array(buffer);a.HEAPU32=new Uint32Array(buffer);a.HEAPF32=new Float32Array(buffer);a.HEAPF64=new Float64Array(buffer)}var L,M,N,O,P,Q,R;L=M=N=O=P=Q=R=0;
function ea(){x("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value "+S+", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ")}var T=a.TOTAL_STACK||5242880,S=a.TOTAL_MEMORY||16777216;S<T&&z("TOTAL_MEMORY should be larger than TOTAL_STACK, was "+S+"! (TOTAL_STACK="+T+")");
a.buffer?buffer=a.buffer:("object"===typeof WebAssembly&&"function"===typeof WebAssembly.Memory?(a.wasmMemory=new WebAssembly.Memory({initial:S/65536,maximum:S/65536}),buffer=a.wasmMemory.buffer):buffer=new ArrayBuffer(S),a.buffer=buffer);da();function U(b){for(;0<b.length;){var d=b.shift();if("function"==typeof d)d();else{var e=d.f;"number"===typeof e?void 0===d.a?a.dynCall_v(e):a.dynCall_vi(e,d.a):e(void 0===d.a?null:d.a)}}}var fa=[],ha=[],ia=[],ja=[],ka=!1;
function la(){var b=a.preRun.shift();fa.unshift(b)}var V=0,W=null,X=null;a.preloadedImages={};a.preloadedAudios={};function Y(b){return String.prototype.startsWith?b.startsWith("data:application/octet-stream;base64,"):0===b.indexOf("data:application/octet-stream;base64,")}
(function(){function b(){try{if(a.wasmBinary)return new Uint8Array(a.wasmBinary);if(a.readBinary)return a.readBinary(g);throw"both async and sync fetching of the wasm failed";}catch(na){x(na)}}function d(){return a.wasmBinary||!n&&!p||"function"!==typeof fetch?new Promise(function(c){c(b())}):fetch(g,{credentials:"same-origin"}).then(function(b){if(!b.ok)throw"failed to load wasm binary file at '"+g+"'";return b.arrayBuffer()}).catch(function(){return b()})}function e(b){function c(b){k=b.exports;
if(k.memory){b=k.memory;var c=a.buffer;b.byteLength<c.byteLength&&z("the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here");c=new Int8Array(c);(new Int8Array(b)).set(c);a.buffer=buffer=b;da()}a.asm=k;a.usingWasm=!0;V--;a.monitorRunDependencies&&a.monitorRunDependencies(V);0==V&&(null!==W&&(clearInterval(W),W=null),X&&(b=X,X=null,b()))}function e(b){c(b.instance)}function h(b){d().then(function(b){return WebAssembly.instantiate(b,f)}).then(b,function(b){z("failed to asynchronously prepare wasm: "+
b);x(b)})}if("object"!==typeof WebAssembly)return z("no native wasm support detected"),!1;if(!(a.wasmMemory instanceof WebAssembly.Memory))return z("no native wasm Memory in use"),!1;b.memory=a.wasmMemory;f.global={NaN:NaN,Infinity:Infinity};f["global.Math"]=Math;f.env=b;V++;a.monitorRunDependencies&&a.monitorRunDependencies(V);if(a.instantiateWasm)try{return a.instantiateWasm(f,c)}catch(oa){return z("Module.instantiateWasm callback failed with error: "+oa),!1}a.wasmBinary||"function"!==typeof WebAssembly.instantiateStreaming||
Y(g)||"function"!==typeof fetch?h(e):WebAssembly.instantiateStreaming(fetch(g,{credentials:"same-origin"}),f).then(e,function(b){z("wasm streaming compile failed: "+b);z("falling back to ArrayBuffer instantiation");h(e)});return{}}var c="asap.wast",g="asap.wasm",h="asap.temp.asm.js";Y(c)||(c=u(c));Y(g)||(g=u(g));Y(h)||(h=u(h));var f={global:null,env:null,asm2wasm:aa,parent:a},k=null;a.asmPreload=a.asm;var H=a.reallocBuffer;a.reallocBuffer=function(b){if("asmjs"===pa)var c=H(b);else a:{var d=a.usingWasm?
65536:16777216;0<b%d&&(b+=d-b%d);d=a.buffer.byteLength;if(a.usingWasm)try{c=-1!==a.wasmMemory.grow((b-d)/65536)?a.buffer=a.wasmMemory.buffer:null;break a}catch(sa){c=null;break a}c=void 0}return c};var pa="";a.asm=function(b,c){if(!c.table){b=a.wasmTableSize;void 0===b&&(b=1024);var d=a.wasmMaxTableSize;c.table="object"===typeof WebAssembly&&"function"===typeof WebAssembly.Table?void 0!==d?new WebAssembly.Table({initial:b,maximum:d,element:"anyfunc"}):new WebAssembly.Table({initial:b,element:"anyfunc"}):
Array(b);a.wasmTable=c.table}c.memoryBase||(c.memoryBase=a.STATIC_BASE);c.tableBase||(c.tableBase=0);c=e(c);assert(c,"no binaryen method succeeded.");return c}})();L=1024;M=L+32352;ha.push();a.STATIC_BASE=L;a.STATIC_BUMP=32352;var ma=M+=16;M=M+4+15&-16;R=ma;N=O=A(M);P=N+T;Q=A(P);K[R>>2]=Q;a.wasmTableSize=3;a.wasmMaxTableSize=3;a.b={};
a.c={abort:x,enlargeMemory:function(){ea()},getTotalMemory:function(){return S},abortOnCannotGrowMemory:ea,___setErrNo:function(b){a.___errno_location&&(K[a.___errno_location()>>2]=b);return b},_emscripten_memcpy_big:function(b,d,e){G.set(G.subarray(d,d+e),b);return b},DYNAMICTOP_PTR:R,STACKTOP:O};var qa=a.asm(a.b,a.c,buffer);a.asm=qa;a._emu_compute_audio_samples=function(){return a.asm._emu_compute_audio_samples.apply(null,arguments)};
a._emu_get_audio_buffer=function(){return a.asm._emu_get_audio_buffer.apply(null,arguments)};a._emu_get_audio_buffer_length=function(){return a.asm._emu_get_audio_buffer_length.apply(null,arguments)};a._emu_get_current_position=function(){return a.asm._emu_get_current_position.apply(null,arguments)};a._emu_get_max_position=function(){return a.asm._emu_get_max_position.apply(null,arguments)};a._emu_get_number_channels=function(){return a.asm._emu_get_number_channels.apply(null,arguments)};
a._emu_get_sample_rate=function(){return a.asm._emu_get_sample_rate.apply(null,arguments)};a._emu_get_trace_streams=function(){return a.asm._emu_get_trace_streams.apply(null,arguments)};a._emu_get_track_info=function(){return a.asm._emu_get_track_info.apply(null,arguments)};a._emu_load_file=function(){return a.asm._emu_load_file.apply(null,arguments)};a._emu_number_trace_streams=function(){return a.asm._emu_number_trace_streams.apply(null,arguments)};
a._emu_seek_position=function(){return a.asm._emu_seek_position.apply(null,arguments)};a._emu_set_boost=function(){return a.asm._emu_set_boost.apply(null,arguments)};a._emu_set_subsong=function(){return a.asm._emu_set_subsong.apply(null,arguments)};a._emu_teardown=function(){return a.asm._emu_teardown.apply(null,arguments)};a._free=function(){return a.asm._free.apply(null,arguments)};a._malloc=function(){return a.asm._malloc.apply(null,arguments)};
var E=a.stackAlloc=function(){return a.asm.stackAlloc.apply(null,arguments)},D=a.stackRestore=function(){return a.asm.stackRestore.apply(null,arguments)},C=a.stackSave=function(){return a.asm.stackSave.apply(null,arguments)};a.dynCall_v=function(){return a.asm.dynCall_v.apply(null,arguments)};a.asm=qa;
a.ccall=function(b,d,e,c){var g=a["_"+b];assert(g,"Cannot call unknown function "+b+", make sure it is exported");var h=[];b=0;if(c)for(var f=0;f<c.length;f++){var k=ba[e[f]];k?(0===b&&(b=C()),h[f]=k(c[f])):h[f]=c[f]}e=g.apply(null,h);e="string"===d?J(e):"boolean"===d?!!e:e;0!==b&&D(b);return e};a.Pointer_stringify=J;X=function ra(){a.calledRun||Z();a.calledRun||(X=ra)};
function Z(){function b(){if(!a.calledRun&&(a.calledRun=!0,!B)){ka||(ka=!0,U(ha));U(ia);if(a.onRuntimeInitialized)a.onRuntimeInitialized();if(a.postRun)for("function"==typeof a.postRun&&(a.postRun=[a.postRun]);a.postRun.length;){var b=a.postRun.shift();ja.unshift(b)}U(ja)}}if(!(0<V)){if(a.preRun)for("function"==typeof a.preRun&&(a.preRun=[a.preRun]);a.preRun.length;)la();U(fa);0<V||a.calledRun||(a.setStatus?(a.setStatus("Running..."),setTimeout(function(){setTimeout(function(){a.setStatus("")},1);
b()},1)):b())}}a.run=Z;function x(b){if(a.onAbort)a.onAbort(b);void 0!==b?(y(b),z(b),b=JSON.stringify(b)):b="";B=!0;throw"abort("+b+"). Build with -s ASSERTIONS=1 for more info.";}a.abort=x;if(a.preInit)for("function"==typeof a.preInit&&(a.preInit=[a.preInit]);0<a.preInit.length;)a.preInit.pop()();a.noExitRuntime=!0;Z();
  return {
	Module: Module,  // expose original Module
  };
})(window.spp_backend_state_ASAP);
/*
 asap_adapter.js: Adapts ASAP backend to generic WebAudio/ScriptProcessor player.

   version 1.1
   copyright (C) 2015-2023 Juergen Wothke

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
class ASAPBackendAdapter extends EmsHEAP16BackendAdapter {
	constructor(scopeEnabled)
	{
		super(backend_ASAP.Module, 2, new SimpleFileMapper(backend_ASAP.Module),
				new HEAP16ScopeProvider(backend_ASAP.Module, 0x8000));

		this._scopeEnabled = (typeof scopeEnabled == 'undefined') ? false : scopeEnabled;

		this.ensureReadyNotification();
	}

	enableScope(enable)
	{
		this._scopeEnabled = enable;
	}

	loadMusicData(sampleRate, path, filename, data, options)
	{
		let ret = this._loadMusicDataBuffer(filename, data, ScriptNodePlayer.getWebAudioSampleRate(), 1024, this._scopeEnabled);

		if (ret == 0)
		{
			this._setupOutputResampling(sampleRate);

			this._channels = this.Module.ccall('emu_get_number_channels', 'number');
		}
		return ret;
	}

	evalTrackOptions(options)
	{
		super.evalTrackOptions(options);

		let boostVolume= (options.boostVolume) ? options.boostVolume : 0;
		this.Module.ccall('emu_set_boost', 'number', ['number'], [boostVolume]);

		this.updateSongInfo("");
		let id = (options.track < 0) ? this._songInfo.actualSubsong : options.track;

		let r = this.Module.ccall('emu_set_subsong', 'number', ['number'], [id]);

		return r;
	}

	getSongInfoMeta()
	{
		return {
			songName: String,
			songAuthor: String,
			songReleased: String,
			maxSubsong: Number,
			actualSubsong: Number
		};
	}

	updateSongInfo(filename)
	{
		let result = this._songInfo;
		
		let numAttr = 5;
		let ret = this.Module.ccall('emu_get_track_info', 'number');

		let array = this.Module.HEAP32.subarray(ret>>2, (ret>>2)+numAttr);
		result.songName = this.Module.Pointer_stringify(array[0]);
		if (!result.songName.length) result.songName = this._makeTitleFromPath(filename);

		result.songAuthor = this.Module.Pointer_stringify(array[1]);
		result.songReleased = this.Module.Pointer_stringify(array[2]);
		result.maxSubsong = parseInt(this.Module.Pointer_stringify(array[3]));
		result.actualSubsong = parseInt(this.Module.Pointer_stringify(array[4]));
	}
};


/* <wrapper> */
return createCodecPlayer(ScriptNodePlayer, ASAPBackendAdapter);
}
/* </wrapper> */
