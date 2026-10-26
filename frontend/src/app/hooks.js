import { useDispatch, useSelector, useStore } from "react-redux";

/** The only place react-redux hooks are used directly (FE-10). */
export const useAppDispatch = useDispatch;
export const useAppSelector = useSelector;
export const useAppStore = useStore;
