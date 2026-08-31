import { type I18n } from '@lingui/core';
import { MainText } from 'src/components/MainText';
import { SubTitle } from 'src/components/SubTitle';

type WhatIsTwentyProps = {
  i18n: I18n;
};

export const WhatIsTwenty = ({ i18n }: WhatIsTwentyProps) => {
  return (
    <>
      <SubTitle value={i18n._('What is binalab?')} />
      <MainText>
        {i18n._(
          "binalab is an AI-native CRM that manages your customer journeys end to end.",
        )}
      </MainText>
    </>
  );
};
