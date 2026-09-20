'use client'
import {useLinkStatus} from 'next/link'
export function Pending(){const {pending}=useLinkStatus();return pending?<span role="status" className="meta"> 加载中…</span>:null}
