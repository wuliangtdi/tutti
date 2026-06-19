/**
 * Maps a permission-mode dropdown selection onto a settings patch.
 *
 * Plan mode is no longer a dropdown option — it is an independent toggle
 * surfaced via Shift+Tab and the plan badge. For providers where plan mode and
 * permission mode are mutually exclusive (claude-code: plan overrides the
 * permission mode in the daemon), picking a permission mode also clears plan
 * mode. For providers where plan rides alongside the permission mode (codex:
 * plan is an independent collaboration mode), plan is left untouched.
 */
export function permissionModeSelectionPatch(
  permissionModeId: string,
  options: { clearsPlanMode: boolean }
): { permissionModeId: string; planMode?: boolean } {
  return options.clearsPlanMode
    ? { permissionModeId, planMode: false }
    : { permissionModeId };
}
