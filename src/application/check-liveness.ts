export type LivenessResult = {
  status: "alive";
};

export function checkLiveness(): LivenessResult {
  return { status: "alive" };
}
