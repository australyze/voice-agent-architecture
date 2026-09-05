export type ErrorEnvelope = {
  success: false;
  error: {
    message: string;
    code: string;
    details: null;
  };
};
