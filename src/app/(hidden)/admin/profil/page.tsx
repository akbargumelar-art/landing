"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { authClient } from "@/lib/auth-client";
import { User, Save, Loader2, KeyRound } from "lucide-react";

export default function ProfilPage() {
    const { data: session, isPending } = useSession();

    // Name Update state
    const [name, setName] = useState("");
    const [isUpdatingName, setIsUpdatingName] = useState(false);
    const [nameMessage, setNameMessage] = useState({ type: "", text: "" });

    // Password Update state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        if (session?.user?.name) {
            setName(session.user.name);
        }
    }, [session]);

    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault();
        setNameMessage({ type: "", text: "" });

        if (!name.trim()) {
            setNameMessage({ type: "error", text: "Nama tidak boleh kosong." });
            return;
        }

        setIsUpdatingName(true);
        try {
            const { error } = await authClient.updateUser({
                name: name,
            });

            if (error) {
                setNameMessage({ type: "error", text: error.message || "Gagal memperbarui profil." });
            } else {
                setNameMessage({ type: "success", text: "Profil berhasil diperbarui." });
            }
        } catch (err: unknown) {
            const error = err as Error;
            setNameMessage({ type: "error", text: error.message || "Terjadi kesalahan." });
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage({ type: "", text: "" });

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: "error", text: "Konfirmasi password tidak cocok." });
            return;
        }

        if (newPassword.length < 8) {
            setPasswordMessage({ type: "error", text: "Password minimal 8 karakter." });
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const { error } = await authClient.changePassword({
                newPassword: newPassword,
                currentPassword: currentPassword,
                revokeOtherSessions: true,
            });

            if (error) {
                setPasswordMessage({ type: "error", text: error.message || "Gagal mengubah password." });
            } else {
                setPasswordMessage({ type: "success", text: "Password berhasil diubah." });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            }
        } catch (err: unknown) {
            const error = err as Error;
            setPasswordMessage({ type: "error", text: error.message || "Terjadi kesalahan." });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    if (isPending) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Pengaturan Profil</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Update Profile Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                            <User className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Informasi Dasar</h2>
                            <p className="text-sm text-gray-500">Perbarui nama tampilan Anda</p>
                        </div>
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleUpdateName} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={session?.user?.email || ""}
                                    disabled
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={session?.user?.name || "Nama Admin"}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-600/20 focus:border-red-600 outline-none transition-all"
                                    required
                                />
                            </div>

                            {nameMessage.text && (
                                <div className={`p-3 rounded-lg text-sm ${nameMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {nameMessage.text}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isUpdatingName || name === session?.user?.name}
                                    className="w-full sm:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {isUpdatingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Change Password Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                            <KeyRound className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Ubah Password</h2>
                            <p className="text-sm text-gray-500">Pastikan akun Anda tetap aman</p>
                        </div>
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password Saat Ini</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-600/20 focus:border-red-600 outline-none transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    minLength={8}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-600/20 focus:border-red-600 outline-none transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    minLength={8}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-600/20 focus:border-red-600 outline-none transition-all"
                                    required
                                />
                            </div>

                            {passwordMessage.text && (
                                <div className={`p-3 rounded-lg text-sm ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {passwordMessage.text}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                                    className="w-full sm:w-auto px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Ubah Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
