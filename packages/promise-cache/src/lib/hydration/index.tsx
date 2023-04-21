import * as React from "react";
import {isServer} from "../../utils";
import {HydrationClient} from "./client";
import {HydrationServer} from "./server";


export function Hydration({id}: { id: string }) {
  if (!id) {
    throw new Error("Please give a unique id to Hydration!");
  }
  if (!isServer) {
    return <HydrationClient id={id} />;
  }
  return <HydrationServer id={id} />;
}

export function SuspenseBoundary({
  fallback,
  children,
  id,
}: {
  id: string;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={fallback}>
      {children}
      <Hydration id={id}/>
    </React.Suspense>
  );
}
