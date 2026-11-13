'use client'
import {useLinkStatus} from 'next/link'
import { useT } from './i18n/LocaleProvider'
export function Pending(){const t=useT();const {pending}=useLinkStatus();return pending?<span role="status" className="meta"> {t("加载中…","Loading…")}</span>:null}
