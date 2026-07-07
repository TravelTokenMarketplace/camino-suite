import { default as React } from 'react'
import { BrowserRouter } from 'react-router-dom'
import ScrollToTop from '../components/ScrollToTop'
import MainLayout from './MainLayout'
import RoutesSuite from './RoutesSuite'

// GitHub Pages serves the app under a repo subpath (e.g. /camino-suite); the prod
// build injects ROUTER_BASENAME so client-side routing resolves under it. Defaults
// to '/' for local dev and any root-hosted build (same pattern as STRAPI_BASE_URL).
const basename = process.env.ROUTER_BASENAME || '/'

export default function Layout() {
    return (
        <BrowserRouter basename={basename}>
            <ScrollToTop />
            <MainLayout>
                <RoutesSuite />
            </MainLayout>
        </BrowserRouter>
    )
}
