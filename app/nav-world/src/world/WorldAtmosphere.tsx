import { Environment, Lightformer, Sky } from "@react-three/drei";

const environmentTarget: [number, number, number] = [0, 2, 0];
const sunPosition: [number, number, number] = [-120, 46, 80];

export function WorldAtmosphere() {
  return (
    <>
      <Sky
        distance={450000}
        mieCoefficient={0.006}
        mieDirectionalG={0.84}
        rayleigh={1.75}
        sunPosition={sunPosition}
        turbidity={5.4}
      />
      <Environment
        background={false}
        environmentIntensity={0.38}
        frames={1}
        resolution={64}
      >
        <color attach="background" args={["#71838a"]} />
        <Lightformer
          color="#ffd4aa"
          form="rect"
          intensity={2.8}
          position={[-18, 12, 10]}
          scale={[18, 10]}
          target={environmentTarget}
        />
        <Lightformer
          color="#a9d6e2"
          form="rect"
          intensity={1.7}
          position={[14, 9, -16]}
          scale={[16, 12]}
          target={environmentTarget}
        />
        <Lightformer
          color="#d7dfd2"
          form="ring"
          intensity={0.7}
          position={[0, -12, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={24}
        />
      </Environment>
    </>
  );
}
