import { createBrowserRouter } from "react-router";
import { routes } from "@/app/routes";

/** The one browser router (FE-65). It never imports the store; bootstrap wires navigation into listeners. */
export const router = createBrowserRouter(routes);
