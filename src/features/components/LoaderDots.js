import React from "react";
import styled, { keyframes } from "styled-components";

function LoaderDots() {
  return (
    <Wrapper>
      <DotsDiv></DotsDiv>
      <DotsDiv></DotsDiv>
      <DotsDiv></DotsDiv>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  &div:nth-child(2) {
    animation-delay: 0.2s;
  }
  &div:nth-child(3) {
    animation-delay: 0.4s;
  }
`;

const fadingLoader = keyframes`
to {
    opacity: 0.1;
  }
`;

const DotsDiv = styled.div`
  width: 8px;
  height: 8px;
  margin: 1.5px 3px;
  border-radius: 50%;
  background-color: #a3a1a1;
  opacity: 1;
  animation: ${fadingLoader} 0.6s infinite alternate;
`;

export default LoaderDots;
