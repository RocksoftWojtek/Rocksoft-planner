'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <span className="text-white font-semibold text-xl">Planner</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Reset hasła</h1>
          <p className="text-slate-400 mt-1 text-sm">Wyślemy link resetujący na Twój email</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">📬</div>
              <p className="text-green-400 font-medium text-sm">Link wysłany!</p>
              <p className="text-slate-400 text-sm mt-1">
                Sprawdź skrzynkę <span className="text-white">{email}</span> i kliknij link w wiadomości.
              </p>
            </div>
            <Link
              href="/auth/login"
              className="block w-full text-center bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm"
            >
              Wróć do logowania
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@rocksoft.pl"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition text-sm"
            >
              {loading ? 'Wysyłanie…' : 'Wyślij link resetujący'}
            </button>

            <Link
              href="/auth/login"
              className="block w-full text-center text-sm text-slate-500 hover:text-slate-300 transition mt-2"
            >
              Wróć do logowania
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
