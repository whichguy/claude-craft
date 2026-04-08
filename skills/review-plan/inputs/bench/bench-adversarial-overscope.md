# Plan: Fix Form Submit Button and Comprehensive Form Module Refactor

## Context

This plan addresses the bug where the submit button doesn't disable during form submission in the contact form. Additionally, we'll modernize the entire form module by migrating to React Hook Form with Zod validation, converting CSS to Tailwind, implementing E2E tests, and creating a Storybook for form components.

**Current Stack:**
- React 18.2.0 with TypeScript
- Vite 4.3.9
- Custom form handling with useState
- CSS Modules (form.module.css)
- Vitest for unit tests

**Files to Modify:**
- `/Users/jwiese/src/claude-craft/src/components/ContactForm/ContactForm.tsx`
- `/Users/jwiese/src/claude-craft/src/components/ContactForm/form.module.css`
- `/Users/jwiese/src/claude-craft/src/components/ContactForm/useFormValidation.ts`
- `/Users/jwiese/src/claude-craft/src/components/NewsletterForm/NewsletterForm.tsx`
- `/Users/jwiese/src/claude-craft/src/components/LoginForm/LoginForm.tsx`
- `/Users/jwiese/src/claude-craft/src/styles/shared-form.css`

**Files to Create:**
- `/Users/jwiese/src/claude-craft/src/components/ContactForm/ContactForm.stories.tsx`
- `/Users/jwiese/src/claude-craft/src/components/ContactForm/validation.schema.ts`
- `/Users/jwiese/src/claude-craft/tests/e2e/contact-form.spec.ts`
- `/Users/jwiese/src/claude-craft/.storybook/main.ts`
- `/Users/jwiese/src/claude-craft/.storybook/preview.ts`
- `/Users/jwiese/src/claude-craft/playwright.config.ts`

## Git Setup

Since we're making extensive changes across multiple phases, we'll create a feature branch:

```bash
git checkout -b feature/form-refactor-and-button-fix
```

## Phase 1: Install Dependencies

Install React Hook Form, Zod, Tailwind CSS, Playwright, and Storybook.

```bash
npm install react-hook-form @hookform/resolvers zod
npm install -D tailwindcss postcss autoprefixer @storybook/react @storybook/react-vite @storybook/addon-essentials @playwright/test
npx tailwindcss init -p
```

Update `/Users/jwiese/src/claude-craft/tailwind.config.js`:
```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Add Tailwind directives to `/Users/jwiese/src/claude-craft/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```bash
git add package.json package-lock.json tailwind.config.js postcss.config.js src/index.css
git commit -m "Install React Hook Form, Zod, Tailwind, Playwright, and Storybook dependencies"
```

## Phase 2: Configure Playwright and Storybook

Create Playwright configuration at `/Users/jwiese/src/claude-craft/playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

Create Storybook configuration at `/Users/jwiese/src/claude-craft/.storybook/main.ts`:
```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
```

Create preview configuration at `/Users/jwiese/src/claude-craft/.storybook/preview.ts`:
```typescript
import type { Preview } from '@storybook/react';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test:e2e": "playwright test"
  }
}
```

```bash
git add playwright.config.ts .storybook/ package.json
git commit -m "Configure Playwright for E2E testing and Storybook for component development"
```

## Phase 3: Create Zod Validation Schema

Create validation schema at `/Users/jwiese/src/claude-craft/src/components/ContactForm/validation.schema.ts`:
```typescript
import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(100),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
```

```bash
git add src/components/ContactForm/validation.schema.ts
git commit -m "Add Zod validation schema for contact form"
```

## Phase 4: Refactor ContactForm to React Hook Form with Tailwind

Update `/Users/jwiese/src/claude-craft/src/components/ContactForm/ContactForm.tsx` to use React Hook Form, Zod validation, and Tailwind classes:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactFormSchema, type ContactFormData } from './validation.schema';
import { useState } from 'react';

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Submission failed');
      
      reset();
      alert('Message sent successfully!');
    } catch (error) {
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-4">
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          Name
        </label>
        <input
          id="name"
          type="text"
          {...register('name')}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
          Subject
        </label>
        <input
          id="subject"
          type="text"
          {...register('subject')}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.subject && (
          <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
        )}
      </div>

      <div className="mb-6">
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
          Message
        </label>
        <textarea
          id="message"
          rows={5}
          {...register('message')}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.message && (
          <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
```

Delete the old CSS module file:
```bash
rm /Users/jwiese/src/claude-craft/src/components/ContactForm/form.module.css
rm /Users/jwiese/src/claude-craft/src/components/ContactForm/useFormValidation.ts
```

```bash
git add src/components/ContactForm/ContactForm.tsx
git add -u src/components/ContactForm/form.module.css src/components/ContactForm/useFormValidation.ts
git commit -m "Refactor ContactForm to use React Hook Form, Zod validation, and Tailwind CSS"
```

## Phase 5: Refactor NewsletterForm and LoginForm

Update `/Users/jwiese/src/claude-craft/src/components/NewsletterForm/NewsletterForm.tsx`:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { newsletterFormSchema, type NewsletterFormData } from './validation.schema';
import { useState } from 'react';

export function NewsletterForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterFormSchema),
  });

  const onSubmit = async (data: NewsletterFormData) => {
    setIsSubmitting(true);
    try {
      await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
      <input
        type="email"
        {...register('email')}
        placeholder="Enter your email"
        className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        Subscribe
      </button>
    </form>
  );
}
```

Update `/Users/jwiese/src/claude-craft/src/components/LoginForm/LoginForm.tsx`:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormSchema, type LoginFormData } from './validation.schema';
import { useState } from 'react';

export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <input
        type="email"
        {...register('email')}
        className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="password"
        {...register('password')}
        className="w-full px-4 py-2 mb-6 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

Remove shared CSS file:
```bash
rm /Users/jwiese/src/claude-craft/src/styles/shared-form.css
```

```bash
git add src/components/NewsletterForm/ src/components/LoginForm/
git add -u src/styles/shared-form.css
git commit -m "Migrate NewsletterForm and LoginForm to React Hook Form with Tailwind"
```

## Phase 6: Create Storybook Stories

Create story file at `/Users/jwiese/src/claude-craft/src/components/ContactForm/ContactForm.stories.tsx`:
```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ContactForm } from './ContactForm';

const meta: Meta<typeof ContactForm> = {
  title: 'Forms/ContactForm',
  component: ContactForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByRole('button', { name: /send message/i });
    await userEvent.click(submitButton);
  },
};
```

```bash
git add src/components/ContactForm/ContactForm.stories.tsx
git commit -m "Add Storybook stories for ContactForm component"
```

## Phase 7: Implement E2E Tests with Playwright

Create E2E test at `/Users/jwiese/src/claude-craft/tests/e2e/contact-form.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
  });

  test('should disable submit button during submission', async ({ page }) => {
    await page.fill('#name', 'John Doe');
    await page.fill('#email', 'john@example.com');
    await page.fill('#subject', 'Test Subject');
    await page.fill('#message', 'This is a test message.');

    const submitButton = page.getByRole('button', { name: /send message/i });
    
    await submitButton.click();
    
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toHaveText('Sending...');
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /send message/i });
    await submitButton.click();

    await expect(page.getByText(/name must be at least 2 characters/i)).toBeVisible();
    await expect(page.getByText(/invalid email address/i)).toBeVisible();
  });

  test('should submit form successfully with valid data', async ({ page }) => {
    await page.fill('#name', 'Jane Smith');
    await page.fill('#email', 'jane@example.com');
    await page.fill('#subject', 'Business Inquiry');
    await page.fill('#message', 'I would like to discuss a potential collaboration.');

    await page.route('/api/contact', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await page.getByRole('button', { name: /send message/i }).click();

    await expect(page.getByText(/message sent successfully/i)).toBeVisible();
  });
});
```

```bash
git add tests/e2e/contact-form.spec.ts
git commit -m "Add comprehensive E2E tests for contact form with Playwright"
```
