import { createContext, useContext } from 'react';

export const NavigateContext = createContext(
  /** @type {null | ((pageId: string) => void)} */ (null),
);

export function useNavigatePage() {
  const fn = useContext(NavigateContext);
  if (!fn) throw new Error('useNavigatePage must be used within NavigateContext.Provider');
  return fn;
}
