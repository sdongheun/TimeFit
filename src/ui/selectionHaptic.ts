export type SelectionHapticFailure = 'native_unavailable' | 'request_rejected';

export type SelectionHapticDriver = Readonly<{
  selection?: () => void | Promise<void>;
}>;

export type SelectionHapticRequest = () => void;

type SelectionHapticRequesterOptions = Readonly<{
  dev?: boolean;
  onDiagnostic?: (reason: SelectionHapticFailure) => void;
}>;

function failureReason(error: unknown): SelectionHapticFailure {
  if (error instanceof Error && (error.name === 'UnavailabilityError' || /unavailable|not available|missing/i.test(error.message))) {
    return 'native_unavailable';
  }
  return 'request_rejected';
}

export function createSelectionHapticRequester(
  driver: SelectionHapticDriver,
  options: SelectionHapticRequesterOptions = {},
): SelectionHapticRequest {
  const diagnosed = new Set<SelectionHapticFailure>();
  const diagnose = (reason: SelectionHapticFailure) => {
    if (!options.dev || diagnosed.has(reason)) return;
    diagnosed.add(reason);
    options.onDiagnostic?.(reason);
  };

  return () => {
    if (typeof driver.selection !== 'function') {
      diagnose('native_unavailable');
      return;
    }
    try {
      const pending = driver.selection();
      void Promise.resolve(pending).catch((error: unknown) => diagnose(failureReason(error)));
    } catch (error: unknown) {
      diagnose(failureReason(error));
    }
  };
}

export function dispatchSelectionHaptic(shouldRequest: boolean, request: SelectionHapticRequest): void {
  if (shouldRequest) request();
}
