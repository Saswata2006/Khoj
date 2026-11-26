import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Search, ShieldCheck, CheckCircle2 } from "lucide-react";

export function FeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">
            Core Modules
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground font-heading">
            Tailored specifically for campus dynamics
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Whether you need to offload course textbooks after semester exams or retrieve a forgotten cycle lock, Khoj keeps every interaction inside your college ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1: Marketplace */}
          <Card id="marketplace" className="relative flex flex-col justify-between border-border bg-card shadow-xs hover:border-slate-400 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-emerald-400" />
                </div>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 text-xs">
                  Coming Soon
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold font-heading">
                Peer Marketplace
              </CardTitle>
              <CardDescription className="text-sm">
                Buy and sell used academic and daily essentials directly with batchmates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Transparent item condition grading (New, Like New, Good, Fair)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Direct contact requests — no public phone number exposure</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Fair student pricing for engineering books, lab coats, and cycles</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Feature 2: Lost & Found */}
          <Card id="lost-and-found" className="relative flex flex-col justify-between border-border bg-card shadow-xs hover:border-slate-400 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Search className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 text-xs">
                  Coming Soon
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold font-heading">
                Lost & Found Network
              </CardTitle>
              <CardDescription className="text-sm">
                Centralized registry for lost student belongings with verified claim matching.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Proof-of-ownership questions (color, serial digits, unique marks)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Location tagging to department buildings, libraries & hostels</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Claim review workflow prevents wrongful item recovery</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Feature 3: Verified Campus Community */}
          <Card id="security" className="relative flex flex-col justify-between border-border bg-card shadow-xs hover:border-slate-400 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                  Foundation Active
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold font-heading">
                Campus Verification
              </CardTitle>
              <CardDescription className="text-sm">
                Zero anonymous interactions. Every student is verified by institutional email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Allowed institutional domain gates prevent outside bad actors</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Integrated report & moderation system to flag misconduct</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>Hostel block tagging for convenient nearby pick-ups</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
