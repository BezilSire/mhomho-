/** Campaign Zero rules shared by the Worker and the client projection. */
export const CAMPAIGN_ZERO_WINDOW_DAYS = 15;
export const CAMPAIGN_ZERO_WINDOW_MS = CAMPAIGN_ZERO_WINDOW_DAYS * 24 * 60 * 60 * 1000;
export const CAMPAIGN_ZERO_REQUIRED_CLIPS = 1;
export const CAMPAIGN_ZERO_MAX_CLIPS = 3;
/** Campaign Zero approval floor. Paid campaigns use their own qualifying threshold. */
export const CAMPAIGN_ZERO_MIN_VIEWS = 500;
