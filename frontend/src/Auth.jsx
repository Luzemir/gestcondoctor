import React, { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) alert(error.message)
        setLoading(false)
    }

    const handleSignUp = async (e) => {
        e.preventDefault()
        setLoading(true)
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) alert('Verifique seu e-mail para confirmar o cadastro!')
        setLoading(false)
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900">
            <div className="w-full max-w-md p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
                <h2 className="text-3xl font-bold text-center text-blue-500 mb-8">Gestcon Doctor</h2>
                <form className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Email</label>
                        <input
                            type="email"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 mt-1 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300">Senha</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 mt-1 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex space-x-4">
                        <button
                            onClick={handleLogin}
                            disabled={loading}
                            className="flex-1 px-4 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none transition-colors disabled:opacity-50"
                        >
                            Entrar
                        </button>
                        <button
                            onClick={handleSignUp}
                            disabled={loading}
                            className="flex-1 px-4 py-3 text-blue-500 border border-blue-500 rounded-lg hover:bg-blue-500 hover:text-white focus:outline-none transition-all disabled:opacity-50"
                        >
                            Cadastrar
                        </button>
                    </div>

                    <div className="text-center mt-4">
                        <button
                            type="button"
                            onClick={async () => {
                                if (!email) return alert('Por favor, digite seu e-mail no campo acima para resetar a senha.')
                                setLoading(true)
                                const { error } = await supabase.auth.resetPasswordForEmail(email)
                                if (error) alert('Erro ao solicitar reset: ' + error.message)
                                else alert('Confira sua caixa de entrada! Enviamos um link para redefinir sua senha.')
                                setLoading(false)
                            }}
                            className="text-sm text-slate-400 hover:text-blue-400 focus:outline-none underline transition-colors"
                        >
                            Esqueci minha senha
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
