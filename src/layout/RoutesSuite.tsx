import React, { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useDispatch } from 'react-redux'
import { changeActiveApp } from '../redux/slices/app-config'
import Partners from '../views/partners'
import Balances from '../views/partners/Balances'
import ConfigurDistrubitor, { BasicWantedServices } from '../views/partners/ConfigurDistrubitor'
import ConfigurSupplier, { BasicSupportedServices } from '../views/partners/ConfigurSupplier'
import Overreview from '../views/partners/Configuration'
import ManageBots, { BasicManageBots } from '../views/partners/ManageBots'
import Partner from '../views/partners/Partner'
import UpgradeCMAccount from '../views/partners/UpgradeCMAccount'
import PartnersLayout from './PartnersLayout'

/**
 * Slimmed routing for the Partners-only dApp on Base Sepolia.
 * Wallet / Explorer / Governance sections and the old login/create/access flows
 * have been removed; `/` redirects straight into the Partner Showroom.
 */
export default function RoutesSuite() {
    const dispatch = useDispatch()
    const location = useLocation()

    useEffect(() => {
        dispatch(changeActiveApp('Partners'))
    }, [location, dispatch])

    return (
        <Routes>
            <Route path="/" element={<Navigate to="/partners" replace />} />
            <Route path="/partners" element={<PartnersLayout />}>
                <Route index element={<Partners />} />
                <Route path="upgrade" element={<UpgradeCMAccount />} />
                <Route path=":partnerID/distribution" element={<BasicWantedServices />} />
                <Route path=":partnerID/supplier" element={<BasicSupportedServices />} />
                <Route path=":partnerID/bots" element={<BasicManageBots />} />
                <Route path=":partnerID" element={<Partner />} />
                <Route path="messenger-configuration">
                    <Route index element={<Navigate to="mymessenger" replace />} />
                    <Route path="mymessenger" element={<Overreview />} />
                    <Route path="mydetails" element={<Partner />} />
                    <Route path="balances" element={<Balances />} />
                    <Route path="distribution" element={<ConfigurDistrubitor />} />
                    <Route path="supplier" element={<ConfigurSupplier />} />
                    <Route path="bots" element={<ManageBots />} />
                </Route>
            </Route>
            <Route path="*" element={<Navigate to="/partners" replace />} />
        </Routes>
    )
}
