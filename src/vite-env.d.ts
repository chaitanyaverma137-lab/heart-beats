/// <reference types="vite/client" />
declare global {
  interface Window {
    echo: {
      checkForUpdates: () => Promise<{state:string;message:string;version?:string;percent?:number}>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (callback:(status:{state:string;message:string;version?:string;percent?:number})=>void) => () => void;
      pickAudio: () => Promise<{name:string;path:string;url:string;size:number}[]>;
      pickLyrics: () => Promise<{name:string;content:string}|null>;
      findLyrics: (track:{title:string;artist:string}) => Promise<{syncedLyrics:string;plainLyrics:string;source:string}|null>;
      openMini: () => Promise<void>;
      miniControl: (action:string) => void;
      miniState: (state:{title:string;playing:boolean;time:number;duration:number}) => void;
      closeMini: () => void;
      exitPlayerFullscreen: () => void;
      onMiniExpand: (callback:()=>void) => () => void;
      onMiniStateRequest: (callback:()=>void) => () => void;
      onMiniControl: (callback:(action:string)=>void) => () => void;
    };
    hbMini: {
      toggle:()=>void; previous:()=>void; next:()=>void; close:()=>void; expand:()=>void;
      onState:(callback:(state:{title:string;playing:boolean;time:number;duration:number})=>void)=>void;
    };
  }
}
export {};
