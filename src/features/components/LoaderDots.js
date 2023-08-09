import React from "react";
import styled, { keyframes } from "styled-components";

function LoaderDots() {
  return (
    <InlineDiv>
      <Wrapper>
        <DotsDiv></DotsDiv>
        <DotsDiv></DotsDiv>
        <DotsDiv></DotsDiv>
      </Wrapper>
    </InlineDiv>
  );
}

const InlineDiv = styled.div`
  display: inline-block;
`;

const Wrapper = styled.div`
  display: flex;
  width: fit-content;
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
  width: 6px;
  height: 6px;
  margin: 0.75px 1.5px;
  border-radius: 50%;
  background-color: #a3a1a1;
  opacity: 1;
  animation: ${fadingLoader} 0.6s infinite alternate;
`;

export default LoaderDots;
