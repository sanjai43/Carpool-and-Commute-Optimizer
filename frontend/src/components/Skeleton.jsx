export default function Skeleton({ height = 14, width = "100%", style }) {
  return (
    <div
      className="skeleton"
      style={{
        height,
        width,
        borderRadius: 10,
        ...style,
      }}
    />
  );
}

