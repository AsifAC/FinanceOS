import { FormEvent, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type AuthMode = "sign-in" | "sign-up";

export function AuthPanel() {
  const { error, isLoading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const result =
      mode === "sign-in"
        ? await signIn(email, password)
        : await signUp(email, password);

    if (!result.ok) return;

    setStatus(
      mode === "sign-in"
        ? "Signed in."
        : "Account created. Check your email if confirmation is required.",
    );
  }

  return (
    <form
      className="grid gap-3 rounded-lg border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-4"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant={mode === "sign-in" ? "default" : "outline"}
          onClick={() => setMode("sign-in")}
        >
          Sign in
        </Button>
        <Button
          type="button"
          variant={mode === "sign-up" ? "default" : "outline"}
          onClick={() => setMode("sign-up")}
        >
          Sign up
        </Button>
      </div>
      <Input
        autoComplete="email"
        inputMode="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        value={email}
      />
      <Input
        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        type="password"
        value={password}
      />
      {error ? (
        <p className="text-sm font-medium text-[#EF4444]">{error.message}</p>
      ) : null}
      {status ? (
        <p className="text-sm font-medium text-[#00C26E]">{status}</p>
      ) : null}
      <Button disabled={isLoading} type="submit">
        {isLoading
          ? "Working..."
          : mode === "sign-in"
            ? "Sign in"
            : "Create account"}
      </Button>
    </form>
  );
}
