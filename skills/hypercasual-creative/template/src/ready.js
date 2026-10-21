// Anything async the first frame depends on (models, textures, clip JSON)
// registers here; capture scripts wait for all of it before frame 0.
export const pending = [];
export const waitFor = (promise) => {
  pending.push(promise);
  return promise;
};
