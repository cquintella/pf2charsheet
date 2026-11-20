interface Window {
  electronAPI?: {
    isElectron: boolean;
    onCloseRequested: (callback: () => void) => () => void;
    allowClose: () => void;
  };
}
