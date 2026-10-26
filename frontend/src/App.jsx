import { Suspense } from "react";
import { RouterProvider } from "react-router/dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { BootSplash } from "@/app/providers/BootSplash";
import { router } from "@/app/router";
import { store } from "@/app/store";

/* The Suspense boundary covers the first render of a Hindi visitor: Hindi namespaces load on demand (FE-111). */
export default function App() {
    return (
        <AppProviders store={store}>
            <Suspense fallback={<BootSplash />}>
                <RouterProvider router={router} />
            </Suspense>
        </AppProviders>
    );
}
