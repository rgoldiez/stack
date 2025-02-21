import * as React from 'react';
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
  Platform,
  ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaContext, EdgeInsets } from 'react-native-safe-area-context';
import HeaderBackButton from './HeaderBackButton';
import HeaderBackground from './HeaderBackground';
import memoize from '../../utils/memoize';
import {
  Layout,
  HeaderStyleInterpolator,
  HeaderBackButtonProps,
  HeaderOptions,
  HeaderScene,
} from '../../types';

export type Scene<T> = {
  route: T;
  progress: Animated.Node<number>;
};

type Props = HeaderOptions & {
  layout: Layout;
  onGoBack?: () => void;
  title?: React.ReactNode;
  leftLabel?: string;
  scene: HeaderScene;
  styleInterpolator: HeaderStyleInterpolator;
};

type State = {
  titleLayout?: Layout;
  leftLabelLayout?: Layout;
};

const warnIfHeaderStylesDefined = (styles: { [key: string]: any }) => {
  Object.keys(styles).forEach(styleProp => {
    const value = styles[styleProp];

    if (styleProp === 'position' && value === 'absolute') {
      console.warn(
        "position: 'absolute' is not supported on headerStyle. If you would like to render content under the header, use the 'headerTransparent' navigationOption."
      );
    } else if (value !== undefined) {
      console.warn(
        `${styleProp} was given a value of ${value}, this has no effect on headerStyle.`
      );
    }
  });
};

export const getDefaultHeaderHeight = (
  layout: Layout,
  insets: EdgeInsets | null
) => {
  const isLandscape = layout.width > layout.height;

  let headerHeight;

  if (Platform.OS === 'ios') {
    // @ts-ignore
    if (isLandscape && !Platform.isPad) {
      headerHeight = 32;
    } else {
      headerHeight = 44;
    }
  } else if (Platform.OS === 'android') {
    headerHeight = 56;
  } else {
    headerHeight = 64;
  }

  return headerHeight + (insets ? insets.top : 0);
};

export default class HeaderSegment extends React.Component<Props, State> {
  static contextType = SafeAreaContext;

  context!: EdgeInsets | null;

  state: State = {};

  private handleTitleLayout = (e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;
    const { titleLayout } = this.state;

    if (
      titleLayout &&
      height === titleLayout.height &&
      width === titleLayout.width
    ) {
      return;
    }

    this.setState({ titleLayout: { height, width } });
  };

  private handleLeftLabelLayout = (e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;
    const { leftLabelLayout } = this.state;

    if (
      leftLabelLayout &&
      height === leftLabelLayout.height &&
      width === leftLabelLayout.width
    ) {
      return;
    }

    this.setState({ leftLabelLayout: { height, width } });
  };

  private getInterpolatedStyle = memoize(
    (
      styleInterpolator: HeaderStyleInterpolator,
      layout: Layout,
      current: Animated.Node<number>,
      next: Animated.Node<number> | undefined,
      titleLayout: Layout | undefined,
      leftLabelLayout: Layout | undefined
    ) =>
      styleInterpolator({
        current: { progress: current },
        next: next && { progress: next },
        layouts: {
          screen: layout,
          title: titleLayout,
          leftLabel: leftLabelLayout,
        },
      })
  );

  render() {
    const {
      scene,
      layout,
      title: currentTitle,
      leftLabel: previousTitle,
      onGoBack,
      headerTitle,
      headerLeft: left = onGoBack
        ? (props: HeaderBackButtonProps) => <HeaderBackButton {...props} />
        : undefined,
      headerTransparent,
      headerTintColor,
      headerLeftTintColor,
      headerRightTintColor,
      headerBackground,
      headerRight: right,
      headerBackImage: backImage,
      headerBackTitle: leftLabel,
      headerBackTitleVisible,
      headerTruncatedBackTitle: truncatedLabel,
      headerPressColorAndroid: pressColorAndroid,
      headerBackAllowFontScaling: backAllowFontScaling,
      headerTitleAllowFontScaling: titleAllowFontScaling,
      headerTitleStyle: customTitleStyle,
      headerBackTitleStyle: customLeftLabelStyle,
      headerLeftContainerStyle: leftContainerStyle,
      headerRightContainerStyle: rightContainerStyle,
      headerTitleContainerStyle: titleContainerStyle,
      headerStyle: customHeaderStyle,
      styleInterpolator,
    } = this.props;

    const { titleLayout, leftLabelLayout } = this.state;

    const {
      titleStyle,
      leftButtonStyle,
      leftLabelStyle,
      rightButtonStyle,
      backgroundStyle,
    } = this.getInterpolatedStyle(
      styleInterpolator,
      layout,
      scene.progress.current,
      scene.progress.next,
      titleLayout,
      previousTitle ? leftLabelLayout : undefined
    );

    const statusBarHeight = this.context ? this.context.top : 0;

    const {
      height = getDefaultHeaderHeight(layout, this.context),
      minHeight,
      maxHeight,
      backgroundColor,
      borderBottomColor,
      borderBottomEndRadius,
      borderBottomLeftRadius,
      borderBottomRightRadius,
      borderBottomStartRadius,
      borderBottomWidth,
      borderColor,
      borderEndColor,
      borderEndWidth,
      borderLeftColor,
      borderLeftWidth,
      borderRadius,
      borderRightColor,
      borderRightWidth,
      borderStartColor,
      borderStartWidth,
      borderStyle,
      borderTopColor,
      borderTopEndRadius,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderTopStartRadius,
      borderTopWidth,
      borderWidth,
      // @ts-ignore: web support for shadow
      boxShadow,
      elevation,
      shadowColor,
      shadowOffset,
      shadowOpacity,
      shadowRadius,
      opacity,
      ...unsafeStyles
    } = StyleSheet.flatten(customHeaderStyle || {}) as ViewStyle;

    if (process.env.NODE_ENV !== 'production') {
      warnIfHeaderStylesDefined(unsafeStyles);
    }

    const safeStyles = {
      backgroundColor,
      borderBottomColor,
      borderBottomEndRadius,
      borderBottomLeftRadius,
      borderBottomRightRadius,
      borderBottomStartRadius,
      borderBottomWidth,
      borderColor,
      borderEndColor,
      borderEndWidth,
      borderLeftColor,
      borderLeftWidth,
      borderRadius,
      borderRightColor,
      borderRightWidth,
      borderStartColor,
      borderStartWidth,
      borderStyle,
      borderTopColor,
      borderTopEndRadius,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderTopStartRadius,
      borderTopWidth,
      borderWidth,
      // @ts-ignore
      boxShadow,
      elevation,
      shadowColor,
      shadowOffset,
      shadowOpacity,
      shadowRadius,
      opacity,
    };

    // Setting a property to undefined triggers default style
    // So we need to filter them out
    // Users can use `null` instead
    for (const styleProp in safeStyles) {
      // @ts-ignore
      if (safeStyles[styleProp] === undefined) {
        // @ts-ignore
        delete safeStyles[styleProp];
      }
    }

    const leftButton =
      left !== undefined
        ? typeof left === 'function'
          ? left({
              backImage,
              pressColorAndroid,
              allowFontScaling: backAllowFontScaling,
              onPress: onGoBack,
              labelVisible: headerBackTitleVisible,
              label: leftLabel !== undefined ? leftLabel : previousTitle,
              truncatedLabel,
              labelStyle: [leftLabelStyle, customLeftLabelStyle],
              onLabelLayout: this.handleLeftLabelLayout,
              screenLayout: layout,
              titleLayout,
              tintColor: headerLeftTintColor || headerTintColor,
              canGoBack: Boolean(onGoBack),
            })
          : left
        : null;

    return (
      <React.Fragment>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, backgroundStyle]}
        >
          {headerBackground ? (
            typeof headerBackground === 'function' ? (
              headerBackground()
            ) : (
              headerBackground
            )
          ) : headerTransparent ? null : (
            <HeaderBackground style={safeStyles} />
          )}
        </Animated.View>
        <Animated.View
          pointerEvents="box-none"
          style={[{ height, minHeight, maxHeight, opacity }]}
        >
          <View pointerEvents="none" style={{ height: statusBarHeight }} />
          <View pointerEvents="box-none" style={styles.content}>
            {leftButton ? (
              <Animated.View
                pointerEvents="box-none"
                style={[styles.left, leftButtonStyle, leftContainerStyle]}
              >
                {leftButton}
              </Animated.View>
            ) : null}
            <Animated.View
              pointerEvents="box-none"
              style={[
                Platform.select({
                  ios: null,
                  default: { left: leftButton ? 72 : 16 },
                }),
                styles.title,
                titleStyle,
                titleContainerStyle,
              ]}
            >
              {typeof headerTitle === 'function'
                ? headerTitle({
                    children: currentTitle,
                    onLayout: this.handleTitleLayout,
                    allowFontScaling: titleAllowFontScaling,
                    style: [{ color: headerTintColor }, customTitleStyle],
                  })
                : headerTitle}
            </Animated.View>
            {right !== undefined ? (
              <Animated.View
                pointerEvents="box-none"
                style={[styles.right, rightButtonStyle, rightContainerStyle]}
              >
                {typeof right === 'function'
                  ? right({
                      tintColor: headerRightTintColor || headerTintColor,
                    })
                  : right}
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      </React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  right: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  title: Platform.select({
    ios: {},
    default: { position: 'absolute' },
  }),
});
