// Shared environment factors updated each frame by SceneManager, so other
// modules (e.g. entity views) can react to time-of-day without threading state
// through every call. Read-only for consumers.
export const env = {
  night: 0, // 0 = full day, 1 = full night
};
