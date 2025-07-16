declare namespace NodeJS {
  interface ProcessEnv {
    BUN_PUBLIC_APP_WS_AUDIO_URL?: string;
    BUN_PUBLIC_APP_STUN_URL?: string;
    BUN_PUBLIC_APP_ISDEBUG?: string;
    NODE_ENV?: string;
  }
}
