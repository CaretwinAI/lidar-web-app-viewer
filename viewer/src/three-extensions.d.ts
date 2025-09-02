declare module 'three/examples/jsm/loaders/PLYLoader' {
  import { BufferGeometry, LoadingManager } from 'three';
  export class PLYLoader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (geometry: BufferGeometry) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
    parse(data: ArrayBuffer | string): BufferGeometry;
  }
}
