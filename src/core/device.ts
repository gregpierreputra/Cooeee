/** An iPhone, iPod or iPad, where sound made by a web page is silenced by
 *  silent mode, whatever the volume. An iPad asking for the desktop site
 *  says it is a Mac, so a Mac with a touch screen counts too. */
export function silencedBySilentMode(userAgent: string, platform: string, touchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1);
}
