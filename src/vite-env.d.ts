/// <reference types="vite/client" />
declare global {
  interface Window {
    echo: {
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<{state:string;message:string;version?:string;percent?:number}>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (callback:(status:{state:string;message:string;version?:string;percent?:number})=>void) => () => void;
      pickAudio: () => Promise<{name:string;artist?:string;artwork?:string;path:string;url:string;size:number}[]>;
      pickLyrics: () => Promise<{name:string;content:string}|null>;
      findLyrics: (track:{title:string;artist:string}) => Promise<{syncedLyrics:string;plainLyrics:string;source:string}|null>;
      exitPlayerFullscreen: () => void;
    };
  }
}
export {};
