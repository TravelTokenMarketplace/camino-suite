import React from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { SUITE } from '../../constants/route-paths'

const LinkButton = ({ children, type, to }) => {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <Typography variant="body1" component="p">
                {type}
            </Typography>
            <Link
                rel="noopener noreferrer"
                target="_blank"
                style={{ textDecoration: 'none' }}
                to={to}
            >
                <Typography variant="body2" component="p" color={'primary'}>
                    {children}
                </Typography>
            </Link>
        </Box>
    )
}

const Version = () => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            <LinkButton type="Suite" to={SUITE}>
                {process.env.GIT_COMMIT_HASH}
            </LinkButton>
        </Box>
    )
}

export default Version
