/** Whether the entry before this one belongs to Cooeee. The router stores each
 *  entry's position in the history stack as history.state.idx, so position 0
 *  means stepping back would leave the app. Shared by the Back control and by
 *  any screen whose own steps are history entries. */
export function canStepBack(): boolean {
  return ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
}
