import { forwardRef, useMemo, useCallback } from "react";
import {
  Link as TSLink,
  useNavigate as useTSNavigate,
  useParams as useTSParams,
  useLocation as useTSLocation,
} from "@tanstack/react-router";

/**
 * Thin compatibility layer so the existing components keep their
 * react-router-dom style API while running on TanStack Router.
 */

export const Link = forwardRef(function Link({ to, replace, state, ...rest }, ref) {
  return <TSLink ref={ref} to={to} replace={replace} state={state} {...rest} />;
});

export const useNavigate = () => {
  const navigate = useTSNavigate();
  return useCallback(
    (to, options = {}) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      navigate({ to, replace: !!options.replace });
    },
    [navigate],
  );
};

export const useParams = () => useTSParams({ strict: false });

export const useLocation = () => {
  const loc = useTSLocation();
  return useMemo(
    () => ({ ...loc, search: loc.searchStr ?? "" }),
    [loc],
  );
};

export const useSearchParams = () => {
  const loc = useTSLocation();
  const navigate = useTSNavigate();
  const params = useMemo(() => new URLSearchParams(loc.searchStr ?? ""), [loc.searchStr]);

  const setParams = useCallback(
    (next, options = {}) => {
      const resolved =
        typeof next === "function" ? next(new URLSearchParams(loc.searchStr ?? "")) : next;
      const sp = resolved instanceof URLSearchParams ? resolved : new URLSearchParams(resolved);
      navigate({
        to: loc.pathname,
        search: Object.fromEntries(sp.entries()),
        replace: !!options.replace,
      });
    },
    [navigate, loc.pathname, loc.searchStr],
  );

  return [params, setParams];
};
