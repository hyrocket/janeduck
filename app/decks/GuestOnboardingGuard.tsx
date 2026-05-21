"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function GuestOnboardingGuard() {
  const router = useRouter()

  useEffect(() => {
    if (localStorage.getItem("jd_onboarding_done") !== "true") {
      router.replace("/onboarding")
    }
  }, [router])

  return null
}
