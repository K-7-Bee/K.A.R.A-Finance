import { BottomBar, moreSignOutClass } from "@/components/nav/bottom-bar";
import { Sidebar, sidebarSignOutClass } from "@/components/nav/sidebar";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { visibleNav } from "@/lib/navigation";
import { getPersonalWorkspace } from "@/lib/workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace } = await getPersonalWorkspace();
  const nav = visibleNav();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sections={nav.all}
        workspaceName={workspace.name}
        email={user.email}
        signOut={<SignOutButton className={sidebarSignOutClass} />}
      />
      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <BottomBar bar={nav.bar} more={nav.more} signOut={<SignOutButton className={moreSignOutClass} />} />
    </div>
  );
}
