export type TranscribeRequest = {
  audioRef: string;
};

export type TranscribeResult = {
  text: string;
};

export type SynthesizeRequest = {
  text: string;
};

export type SynthesizeResult = {
  audioRef: string;
};

export type SpeechPort = {
  transcribe(request: TranscribeRequest): Promise<TranscribeResult>;
  synthesize(request: SynthesizeRequest): Promise<SynthesizeResult>;
};
