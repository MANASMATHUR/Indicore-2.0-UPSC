"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function FormulaSheetsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4 py-16">
      <Card className="max-w-xl w-full p-10 text-center border-2 border-red-100 shadow-xl bg-white/90 backdrop-blur">
        <div className="flex flex-col items-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-2">Temporarily Offline</p>
            <h1 className="text-3xl font-bold text-gray-900">Formula Sheets Are Under Maintenance</h1>
          </div>
          <p className="text-gray-600 leading-relaxed">
            We&apos;re polishing this experience. Meanwhile, use the chat assistant for custom notes and PYQs.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href="/">
              <Button className="w-full" variant="primary">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Button>
            </Link>
            <Link href="/chat">
              <Button className="w-full" variant="secondary">
                Open Chat Assistant
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
