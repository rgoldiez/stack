import * as React from 'react';
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
  Dimensions,
  Platform,
  ViewProps,
} from 'react-native';
import { NavigationRoute } from 'react-navigation';
import { EdgeInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import * as Screens from 'react-native-screens'; // Import with * as to prevent getters being called
import { getDefaultHeaderHeight } from '../Header/HeaderSegment';
import { Props as HeaderContainerProps } from '../Header/HeaderContainer';
import StackItem from './StackItem';
import {
  DefaultTransition,
  ModalTransition,
} from '../../TransitionConfigs/TransitionPresets';
import { forNoAnimation } from '../../TransitionConfigs/HeaderStyleInterpolators';
import validateDeprecatedOptions from '../../utils/validateDeprecatedOptions';
import {
  Layout,
  HeaderMode,
  NavigationStackProp,
  HeaderScene,
  SceneDescriptorMap,
  NavigationStackOptions,
} from '../../types';

type ProgressValues = {
  [key: string]: Animated.Value<number>;
};

type Props = {
  mode: 'card' | 'modal';
  insets: EdgeInsets | null;
  navigation: NavigationStackProp;
  descriptors: SceneDescriptorMap;
  routes: NavigationRoute[];
  openingRoutesKeys: string[];
  closingRoutesKeys: string[];
  onGoBack: (props: { route: NavigationRoute }) => void;
  onOpenRoute: (props: { route: NavigationRoute }) => void;
  onCloseRoute: (props: { route: NavigationRoute }) => void;
  getPreviousRoute: (props: {
    route: NavigationRoute;
  }) => NavigationRoute | undefined;
  getGesturesEnabled: (props: { route: NavigationRoute }) => boolean;
  renderHeader: (props: HeaderContainerProps) => React.ReactNode;
  renderScene: (props: { route: NavigationRoute }) => React.ReactNode;
  headerMode: HeaderMode;
  onPageChangeStart?: () => void;
  onPageChangeConfirm?: () => void;
  onPageChangeCancel?: () => void;
};

type State = {
  routes: NavigationRoute[];
  descriptors: SceneDescriptorMap;
  scenes: HeaderScene<NavigationRoute>[];
  progress: ProgressValues;
  layout: Layout;
  floatingHeaderHeights: { [key: string]: number };
};

const dimensions = Dimensions.get('window');
const layout = { width: dimensions.width, height: dimensions.height };

let AnimatedScreen: React.ComponentType<
  ViewProps & { active: number | Animated.Node<number> }
>;

const MaybeScreenContainer = ({
  enabled,
  ...rest
}: ViewProps & {
  enabled: boolean;
  children: React.ReactNode;
}) => {
  if (Platform.OS !== 'ios' && enabled && Screens.screensEnabled()) {
    return <Screens.ScreenContainer {...rest} />;
  }

  return <View {...rest} />;
};

const MaybeScreen = ({
  enabled,
  active,
  ...rest
}: ViewProps & {
  enabled: boolean;
  active: number | Animated.Node<number>;
  children: React.ReactNode;
}) => {
  if (Platform.OS !== 'ios' && enabled && Screens.screensEnabled()) {
    AnimatedScreen =
      AnimatedScreen || Animated.createAnimatedComponent(Screens.NativeScreen);

    return <AnimatedScreen active={active} {...rest} />;
  }

  return <View {...rest} />;
};

const FALLBACK_DESCRIPTOR = Object.freeze({ options: {} });

const { cond, eq } = Animated;

const ANIMATED_ONE = new Animated.Value(1);

const getFloatingHeaderHeights = (
  routes: NavigationRoute[],
  insets: EdgeInsets | null,
  layout: Layout,
  previous: { [key: string]: number }
) => {
  const defaultHeaderHeight = getDefaultHeaderHeight(layout, insets);

  return routes.reduce(
    (acc, curr) => {
      acc[curr.key] = previous[curr.key] || defaultHeaderHeight;

      return acc;
    },
    {} as { [key: string]: number }
  );
};

export default class Stack extends React.Component<Props, State> {
  static getDerivedStateFromProps(props: Props, state: State) {
    if (
      props.routes === state.routes &&
      props.descriptors === state.descriptors
    ) {
      return null;
    }

    const progress = props.routes.reduce(
      (acc, curr) => {
        const descriptor = props.descriptors[curr.key];

        acc[curr.key] =
          state.progress[curr.key] ||
          new Animated.Value(
            props.openingRoutesKeys.includes(curr.key) &&
            descriptor &&
            descriptor.options.animationEnabled !== false
              ? 0
              : 1
          );

        return acc;
      },
      {} as ProgressValues
    );

    return {
      routes: props.routes,
      scenes: props.routes.map((route, index, self) => {
        const previousRoute = self[index - 1];
        const nextRoute = self[index + 1];

        const current = progress[route.key];
        const previous = previousRoute
          ? progress[previousRoute.key]
          : undefined;
        const next = nextRoute ? progress[nextRoute.key] : undefined;

        const oldScene = state.scenes[index];
        const scene = {
          route,
          previous: previousRoute,
          descriptor:
            props.descriptors[route.key] ||
            state.descriptors[route.key] ||
            (oldScene ? oldScene.descriptor : FALLBACK_DESCRIPTOR),
          progress: {
            current,
            next,
            previous,
          },
        };

        if (
          oldScene &&
          scene.route === oldScene.route &&
          scene.progress.current === oldScene.progress.current &&
          scene.progress.next === oldScene.progress.next &&
          scene.progress.previous === oldScene.progress.previous &&
          scene.descriptor === oldScene.descriptor
        ) {
          return oldScene;
        }

        return scene;
      }),
      progress,
      descriptors: props.descriptors,
      floatingHeaderHeights: getFloatingHeaderHeights(
        props.routes,
        props.insets,
        state.layout,
        state.floatingHeaderHeights
      ),
    };
  }

  state: State = {
    routes: [],
    scenes: [],
    progress: {},
    layout,
    descriptors: this.props.descriptors,
    // Used when card's header is null and mode is float to make transition
    // between screens with headers and those without headers smooth.
    // This is not a great heuristic here. We don't know synchronously
    // on mount what the header height is so we have just used the most
    // common cases here.
    floatingHeaderHeights: {},
  };

  private handleLayout = (e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;

    if (
      height === this.state.layout.height &&
      width === this.state.layout.width
    ) {
      return;
    }

    const layout = { width, height };

    this.setState({
      layout,
      floatingHeaderHeights: getFloatingHeaderHeights(
        this.props.routes,
        this.props.insets,
        layout,
        {}
      ),
    });
  };

  private handleFloatingHeaderLayout = ({
    route,
    height,
  }: {
    route: NavigationRoute;
    height: number;
  }) => {
    const previousHeight = this.state.floatingHeaderHeights[route.key];

    if (previousHeight && previousHeight === height) {
      return;
    }

    this.setState(state => ({
      floatingHeaderHeights: {
        ...state.floatingHeaderHeights,
        [route.key]: height,
      },
    }));
  };

  private handleTransitionStart = (
    { route }: { route: NavigationRoute },
    closing: boolean
  ) => {
    const { descriptors } = this.props;
    const descriptor = descriptors[route.key];

    descriptor &&
      descriptor.options.onTransitionStart &&
      descriptor.options.onTransitionStart({ closing });
  };

  private handleTransitionEnd = (
    { route }: { route: NavigationRoute },
    closing: boolean
  ) => {
    const descriptor = this.props.descriptors[route.key];

    descriptor &&
      descriptor.options.onTransitionEnd &&
      descriptor.options.onTransitionEnd({ closing });
  };

  render() {
    const {
      mode,
      descriptors,
      navigation,
      routes,
      closingRoutesKeys,
      onOpenRoute,
      onCloseRoute,
      onGoBack,
      getPreviousRoute,
      getGesturesEnabled,
      renderHeader,
      renderScene,
      headerMode,
      onPageChangeStart,
      onPageChangeConfirm,
      onPageChangeCancel,
    } = this.props;

    const { scenes, layout, progress, floatingHeaderHeights } = this.state;

    const focusedRoute = navigation.state.routes[navigation.state.index];
    const focusedDescriptor = descriptors[focusedRoute.key];
    const focusedOptions = focusedDescriptor ? focusedDescriptor.options : {};

    let defaultTransitionPreset =
      mode === 'modal' ? ModalTransition : DefaultTransition;

    if (headerMode === 'screen') {
      defaultTransitionPreset = {
        ...defaultTransitionPreset,
        headerStyleInterpolator: forNoAnimation,
      };
    }

    return (
      <React.Fragment>
        <MaybeScreenContainer
          enabled={mode !== 'modal'}
          style={styles.container}
          onLayout={this.handleLayout}
        >
          {routes.map((route, index, self) => {
            const focused = focusedRoute.key === route.key;
            const current = progress[route.key];
            const scene = scenes[index];
            const next = self[index + 1]
              ? progress[self[index + 1].key]
              : ANIMATED_ONE;

            // Display current screen and a screen beneath. On Android screen beneath is hidden on animation finished bs of RNS's issue.
            const isScreenActive =
              index === self.length - 1
                ? 1
                : Platform.OS === 'android'
                ? cond(eq(next, 1), 0, 1)
                : index === self.length - 2
                ? 1
                : 0;

            if (
              process.env.NODE_ENV !== 'production' &&
              scene.descriptor &&
              scene.descriptor.options
            ) {
              validateDeprecatedOptions(scene.descriptor.options);
            }

            const {
              header,
              headerShown,
              headerTransparent,
              cardTransparent,
              cardShadowEnabled,
              cardOverlayEnabled,
              cardStyle,
              gestureResponseDistance,
              gestureDirection = defaultTransitionPreset.gestureDirection,
              transitionSpec = defaultTransitionPreset.transitionSpec,
              cardStyleInterpolator = defaultTransitionPreset.cardStyleInterpolator,
              headerStyleInterpolator = defaultTransitionPreset.headerStyleInterpolator,
              gestureVelocityImpact,
            } = scene.descriptor
              ? scene.descriptor.options
              : ({} as NavigationStackOptions);

            let transitionConfig = {
              transitionSpec,
              cardStyleInterpolator,
              headerStyleInterpolator,
            };

            // When a screen is not the last, it should use next screen's transition config
            // Many transitions also animate the previous screen, so using 2 different transitions doesn't look right
            // For example combining a slide and a modal transition would look wrong otherwise
            // With this approach, combining different transition styles in the same navigator mostly looks right
            // This will still be broken when 2 transitions have different idle state (e.g. modal presentation),
            // but majority of the transitions look alright
            if (index !== self.length - 1) {
              const nextScene = scenes[index + 1];

              if (nextScene) {
                const {
                  transitionSpec = defaultTransitionPreset.transitionSpec,
                  cardStyleInterpolator = defaultTransitionPreset.cardStyleInterpolator,
                  headerStyleInterpolator = defaultTransitionPreset.headerStyleInterpolator,
                } = nextScene.descriptor
                  ? nextScene.descriptor.options
                  : ({} as NavigationStackOptions);

                transitionConfig = {
                  transitionSpec,
                  cardStyleInterpolator,
                  headerStyleInterpolator,
                };
              }
            }

            return (
              <MaybeScreen
                key={route.key}
                style={StyleSheet.absoluteFill}
                enabled={mode !== 'modal'}
                active={isScreenActive}
                pointerEvents="box-none"
              >
                <StackItem
                  index={index}
                  active={index === self.length - 1}
                  focused={focused}
                  closing={closingRoutesKeys.includes(route.key)}
                  layout={layout}
                  current={current}
                  scene={scene}
                  previousScene={scenes[index - 1]}
                  navigation={navigation}
                  cardTransparent={cardTransparent}
                  cardOverlayEnabled={cardOverlayEnabled}
                  cardShadowEnabled={cardShadowEnabled}
                  cardStyle={cardStyle}
                  onPageChangeStart={onPageChangeStart}
                  onPageChangeConfirm={onPageChangeConfirm}
                  onPageChangeCancel={onPageChangeCancel}
                  floatingHeaderHeight={floatingHeaderHeights[route.key]}
                  headerShown={header !== null && headerShown !== false}
                  getPreviousRoute={getPreviousRoute}
                  headerMode={headerMode}
                  headerTransparent={headerTransparent}
                  renderHeader={renderHeader}
                  renderScene={renderScene}
                  onOpenRoute={onOpenRoute}
                  onCloseRoute={onCloseRoute}
                  onTransitionStart={this.handleTransitionStart}
                  onTransitionEnd={this.handleTransitionEnd}
                  onGoBack={onGoBack}
                  gestureDirection={gestureDirection}
                  transitionSpec={transitionSpec}
                  cardStyleInterpolator={cardStyleInterpolator}
                  headerStyleInterpolator={headerStyleInterpolator}
                  gestureEnabled={index !== 0 && getGesturesEnabled({ route })}
                  gestureResponseDistance={gestureResponseDistance}
                  gestureVelocityImpact={gestureVelocityImpact}
                  {...transitionConfig}
                />
              </MaybeScreen>
            );
          })}
        </MaybeScreenContainer>
        {headerMode === 'float'
          ? renderHeader({
              mode: 'float',
              layout,
              scenes,
              navigation,
              getPreviousRoute,
              onContentHeightChange: this.handleFloatingHeaderLayout,
              styleInterpolator:
                focusedOptions.headerStyleInterpolator !== undefined
                  ? focusedOptions.headerStyleInterpolator
                  : defaultTransitionPreset.headerStyleInterpolator,
              style: styles.floating,
            })
          : null}
      </React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  floating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
