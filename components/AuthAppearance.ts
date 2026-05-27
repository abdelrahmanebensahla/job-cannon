/**
 * Clerk appearance overrides aligned with the locked design system.
 * Strict B&W palette, 4px radius, Geist for body / UI, Newsreader on
 * the social-button & email-field labels handled via element classes.
 *
 * Keep this in one place — both /sign-in and /sign-up consume it.
 *
 * Type elided because @clerk/types isn't a direct dep; the object
 * shape is checked structurally by the SignIn/SignUp `appearance` prop.
 */
export const authAppearance = {
  variables: {
    colorPrimary: '#0A0A0A',
    colorBackground: '#FFFFFF',
    colorText: '#0A0A0A',
    colorTextSecondary: '#737373',
    colorDanger: '#DC2626',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#0A0A0A',
    colorBorder: '#E5E5E5',
    borderRadius: '4px',
    fontFamily: 'var(--font-geist-sans)',
  },
  elements: {
    rootBox: 'w-full',
    card: 'shadow-none border-0 bg-transparent px-0',
    headerTitle: 'font-[var(--font-newsreader)] tracking-tight text-3xl',
    headerSubtitle: 'text-[0.9375rem] text-[#737373]',
    socialButtonsBlockButton:
      'border border-[#E5E5E5] rounded-[4px] text-[0.875rem] text-[#0A0A0A] hover:bg-[#0A0A0A]/5',
    formButtonPrimary:
      'bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/90 rounded-[4px] text-[0.875rem] font-medium normal-case shadow-none',
    formFieldInput:
      'border border-[#E5E5E5] rounded-[4px] focus:ring-2 focus:ring-[#0A0A0A] focus:ring-offset-2',
    footerActionLink: 'text-[#0A0A0A] underline underline-offset-2 hover:text-[#0A0A0A]/80',
    dividerLine: 'bg-[#E5E5E5]',
    dividerText: 'text-[0.75rem] uppercase tracking-wide text-[#737373]',
  },
} as const;
