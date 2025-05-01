# Next.js with Supabase Boilerplate

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) and integrated with [Supabase](https://supabase.com) and [React Flow](https://reactflow.dev/).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase Integration

This project is set up with Supabase integration. Follow these steps to connect your Supabase instance:

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and sign up or log in
2. Create a new project
3. Note your project URL and anon/public key from the project API settings

### 2. Set Up Environment Variables

1. Update the `.env.local` file in the root of your project with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Generate TypeScript Types

To generate TypeScript types from your Supabase database schema:

1. Install the Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Generate types:
```bash
supabase gen types typescript --project-id your-project-id --schema public > src/types/supabase.ts
```

Alternatively, you can use the Supabase browser UI:

1. Go to your Supabase project dashboard
2. Navigate to API > TypeScript
3. Copy the generated types
4. Create a file at `src/types/supabase.ts` and paste the types

### 4. Update the Supabase Client with Types

After generating your types, you need to update the Supabase client to use these types:

1. Create a directory for types if it doesn't exist:
```bash
mkdir -p src/types
```

2. After generating your types in `src/types/supabase.ts`, update the Supabase client in `src/lib/supabase.ts`:

This ensures you get full type safety when interacting with your Supabase database.

## React Flow Integration

This project includes [React Flow](https://reactflow.dev/), a library for building interactive node-based UIs, diagrams, and flowcharts.

### Using the Flow Diagram

The project includes a simple flow diagram component that demonstrates:

- Creating nodes and edges
- Styling nodes and connections
- Adding interactive features
- Connecting nodes dynamically

The diagram is implemented in `src/components/FlowDiagram.tsx` and is displayed on the home page.

### Customizing the Flow Diagram

You can customize the flow diagram by:

1. Modifying the nodes and edges in `src/components/FlowDiagram.tsx`
2. Changing the styling of nodes and edges
3. Adding custom node types
4. Implementing additional interactive features

For more advanced usage, refer to the [React Flow documentation](https://reactflow.dev/docs/introduction/).

## Learn More

To learn more about Next.js, Supabase, and React Flow, check out these resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Supabase Documentation](https://supabase.com/docs) - learn about Supabase features
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction) - learn about the Supabase JavaScript client
- [Supabase TypeScript Support](https://supabase.com/docs/reference/javascript/typescript-support) - learn about Supabase TypeScript integration
- [React Flow Documentation](https://reactflow.dev/docs/introduction/) - learn about React Flow features and API

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
